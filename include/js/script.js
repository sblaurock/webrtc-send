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
			established: 'Connection established.',
			sending: 'Sending...<br /><img src="include/img/loader.gif" />',
			receiving: 'Receiving...<br /><img src="include/img/loader.gif" />',
			file: 'File is ready.<br /><a target="_blank" href="{{url}}">Click here to download!</a>',
			success: '<p class="success">File was sent successfully!</p>',
			error: '<p class="error">A connection could not be established.</p>'
		},
		timeout: {
			connectToHost: 3000
		}
	};

	var _session = {
		id: '',
		reference: null,
		peer: null,
		fileConnection: null,
		textConnection: null
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
			var callback;

			_session.reference.on('connection', function(connection) {
				if(connection.label && connection.label === 'file') {
					callback = function() {
						_setMessage('sending');

						connection.send({
							file: file,
							name: file.name,
							size: file.size,
							type: file.type
						});
					};
				}

				if(connection.label && connection.label === 'text') {
					console.log('text connection established');
					callback = function() {
						_listen(connection, _handleText);
					};
				}

				_handleConnection(connection, callback);
			});
		}
	};

	var _peer = {
		// Connect to host if we have a hash reference to their ID.
		connectToHost: function(peerId) {
			var timeout;
			var fileConnection = _session.reference.connect(peerId, { label: 'file' });
			var textConnection = _session.reference.connect(peerId, { label: 'text' });

			_setMessage('connecting');

			// If we can't connect within defined time frame then message user and destroy session.
			timeout = setTimeout(function() {
				_setMessage('error');
				_session.reference.destroy();

				return;
			}, _options.timeout.connectToHost);

			_handleConnection(fileConnection, function() {
				clearTimeout(timeout);
				_listen(fileConnection, _peer.handleFile);
			});

			_handleConnection(textConnection, function() {
				_listen(textConnection, _handleText);
			});
		},

		// Receive data from host and create a URL when ready.
		handleFile: function(data) {
			var file = data.file;

			if (file && file.constructor === ArrayBuffer) {
				var dataView = new Uint8Array(file);
				var dataBlob = new Blob([dataView], {type: data.type});
				var url = window.URL.createObjectURL(dataBlob);

				_setMessage('file', {
					url: url
				});

				if(_session.textConnection !== null) {
					_session.textConnection.send({
						message: 'success'
					});
				}
			}
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
			if(connection.label && connection.label === 'file') {
				_session.fileConnection = connection;

				_setMessage('established');
			}

			if(connection.label && connection.label === 'text') {
				_session.textConnection = connection;
			}

			if(_session.peer === null) {
				_session.peer = connection.peer;
			}

			if(typeof callback === 'function') {
				callback();
			}
		});

		connection.on('error', function(err) {
			_setMessage('error');
		});
	};

	// Listen for data over connection.
	_listen = function(connection, callback) {
		connection.on('data', function(data) {
			if(typeof callback === 'function') {
				callback(data);
			}
		});
	};

	// Display a message to the user.
	_setMessage = function(identifier, replacements) {
		var message = _options.messages[identifier];

		if(!message || typeof message !== 'string') {
			return false;
		}

		if(replacements !== undefined && typeof replacements === 'object') {
			var placeholders = message.match(/{{[\w]+}}/g) || [];
			var current;
			var replacement;

			for(var i = 0, length = placeholders.length; i < length; i++) {
				current = placeholders[i];
				replacement = replacements[current.replace(/\W/g, '')];

				if(replacement) {
					message = message.replace(current, replacement);
				}
			}
		}

		_options.dropArea.reference.html(message);
	};

	// Receive messages from host and update the UI of status.
	_handleText = function(data) {
		if(data && data.message) {
			_setMessage(data.message, data.replacements);
		}
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