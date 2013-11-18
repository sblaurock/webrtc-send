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
			initializing: 'Creating session...',
			created: 'Session created. Share this link:<br />{{link}}',
			connecting: 'Connecting to peer...',
			errorConnecting: 'A connection could not be established.',
			established: 'Connection established.',
			sending: 'Starting transfer...',
			waiting: 'Waiting for data...'
		}
	};

	var _session = {
		id: '',
		file: null,
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

			_setMessage('drag');
		},

		// Initiate a session when a file is dropped.
		handleDrop: function(e) {
			var dataTransfer = e.originalEvent.dataTransfer;

			if(dataTransfer && dataTransfer.files.length) {
				var file = dataTransfer.files[0];

				_session.file = file;

				_createSession(function(id) {
					_host.listenForPeer(file);
					_setMessage('created', {
						'link': document.URL + '#' + id
					});
				});
			}
		},

		// Listen for incoming connection and send file when established.
		listenForPeer: function(file) {
			_session.reference.on('connection', function(connection) {
				_session.peer = connection.peer;

				_setMessage('established');
				connection.send(file);
			});
		}
	};

	var _peer = {
		// Connect to host if we have a hash reference to their ID.
		connectToHost: function(peerId) {
			_createSession(function(id, reference) {
				var connection = reference.connect(peerId);

				_setMessage('connecting');

				connection.on('open', function() {
					_setMessage('established');
					_session.peer = peerId;

					this.waitForData(connection);
				});

				connection.on('error', function(err) {
					_setMessage('errorConnecting');
				});
			});
		},

		// Create link to stream data from host when available.
		waitForData: function(connection) {
			_setMessage('waiting');

			connection.on('data', function(data) {
				if (data.constructor === ArrayBuffer) {
					var dataView = new Uint8Array(data);
					var dataBlob = new Blob([dataView]);
					var url = window.URL.createObjectURL(dataBlob);

					console.log(url);
				}
			});
		}
	};

	// Create a peer session.
	_createSession = function(callback) {
		var peer = new Peer({
			key: _options.key
		});

		_setMessage('initializing');

		peer.on('open', function(id) {
			_session.id = id;
			_session.reference = peer;

			if(typeof callback === 'function') {
				callback(id, peer);
			}
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
			_host.bindEvents();
		},

		initiatePeer: function(peerId) {
			_peer.connectToHost(peerId);
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