var bytecast = function() {
	var _options = {
		key: '4u478wggtkxzuxr',
		dropArea: {
			reference: $('#drop'),
			hoverClass: 'hover',
			activeClass: 'active'
		},
		messages: {
			drag: 'Drag a file here...',
			initializing: 'Initializing session...',
			ready: 'File is ready. Share this link:<br />{{link}}',
			connecting: 'Connecting to peer...',
			error: 'A connection could not be established.',
			established: 'Connection established.',
			sending: 'Sending...<br /><img src="include/img/loader.gif" />',
			receiving: 'Receiving...<br /><img src="include/img/loader.gif" />',
			file: 'File is ready.<br /><a target="_blank" href="{{url}}">Click here to download!</a>'
		}
	};

	var _session = {
		id: '',
		reference: null,
		peer: null
	};

	var _host = {
		// Bind events around drag and drop functionality.
		bindEvents: function() {
			var toggleDropHover = function(e) {
				_options.dropArea.reference.toggleClass(_options.dropArea.hoverClass);
				stopEvent(e);
			};

			var stopEvent = function(e) {
				e.preventDefault();
				e.stopPropagation();
			};

			_options.dropArea.reference.on('dragover', stopEvent);
			_options.dropArea.reference.on('dragenter', toggleDropHover);
			_options.dropArea.reference.on('dragleave', toggleDropHover);
			_options.dropArea.reference.on('drop', function(e) {
				toggleDropHover(e);
				_host.handleDrop(e);
			});

			window.onunload = window.onbeforeunload = function() {
				var session = _session.reference;

				if (session !== null && !session.destroyed) {
					session.destroy();
				}
			};

			_setMessage('drag');
		},

		// Initiate a session when a file is dropped.
		handleDrop: function(e) {
			var dataTransfer = e.originalEvent.dataTransfer;

			if(dataTransfer && dataTransfer.files.length) {
				var file = dataTransfer.files[0];

				_session.file = file;

				_setMessage('ready', {
					'link': document.URL + '#' + _session.id
				});

				this.listenForPeer(file);
			}
		},

		// Listen for incoming connection and send file when established.
		listenForPeer: function(file) {
			_session.reference.on('connection', function(connection) {
				_handleConnection(connection, function() {
					_setMessage('sending');
					connection.send({
						file: file,
						name: file.name,
						size: file.size,
						type: file.type
					});
				});
			});
		}
	};

	var _peer = {
		// Connect to host if we have a hash reference to their ID.
		connectToHost: function(peerId) {
			var connection = _session.reference.connect(peerId);

			_setMessage('connecting');
			_handleConnection(connection, function() {
				_peer.waitForData(connection);
			});
		},

		// Create link to stream data from host when available.
		waitForData: function(connection) {
			_setMessage('receiving');

			connection.on('data', function(data) {
				var file = data.file;

				if (file && file.constructor === ArrayBuffer) {
					var dataView = new Uint8Array(file);
					var dataBlob = new Blob([dataView], {type: data.type});
					var url = window.URL.createObjectURL(dataBlob);

					_setMessage('file', {
						url: url
					});
				}
			});
		}
	};

	// Create a peer session.
	_createSession = function(callback) {
		var session = new Peer({
			key: _options.key
		});

		_setMessage('initializing');

		session.on('open', function(id) {
			_session.id = id;
			_session.reference = session;

			if(typeof callback === 'function') {
				callback();
			}
		});
	};

	// Bind connection handler.
	_handleConnection = function(connection, callback) {
		connection.on('open', function() {
			_session.peer = connection.peer;

			_setMessage('established');

			if(typeof callback === 'function') {
				callback();
			}
		});

		connection.on('error', function(err) {
			_setMessage('errorConnecting');
		});
	};

	// Display a message to the user.
	_setMessage = function(identifier, data) {
		var message = _options.messages[identifier];

		if(!message || typeof message !== 'string') {
			return false;
		}

		if(data !== undefined && typeof data === 'object') {
			var placeholders = message.match(/{{[\w]+}}/g) || [];
			var current;
			var replacement;

			for(var i = 0, length = placeholders.length; i < length; i++) {
				current = placeholders[i];
				replacement = data[current.replace(/\W/g, '')];

				if(replacement) {
					message = message.replace(current, replacement);
				}
			}
		}

		_options.dropArea.reference.html(message);
	};

	// Public interface.
	return {
		initiateHost: function() {
			_createSession(function() {
				_host.bindEvents();
			});
		},

		initiatePeer: function(peerId) {
			_createSession(function(id, session) {
				_peer.connectToHost(peerId);
			});
		}
	};
}();

// Kick out the jams.
$(document).ready(function() {
	var hash = window.location.hash;

	if(hash && typeof hash === 'string' && hash.length > 0) {
		bytecast.initiatePeer(hash.replace(/\W/g, ''));
	} else {
		bytecast.initiateHost();
	}
});