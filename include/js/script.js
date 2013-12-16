var dropsend = function($, document) {
	var _options = {
		key: '48y8nbsocrf6r',
		dropArea: {
			reference: $('#drop'),
			status: $('#status'),
			classes: {
				ready: 'ready',
				hover: 'hover'
			},
		},
		message: {
			reference: $('#message'),
			classes: {
				open: 'open'
			}
		},
		text: {
			statuses: {
				drop: 'Drop a file here...',
				initializing: 'Initializing session...',
				connecting: 'Connecting to peer...',
				established: 'Connection established.',
				sending: 'Sending...',
				receiving: 'Receiving...',
				success: '<p class="success">File successfully sent.</p>',
				error: '<p class="error">Attempt to connect failed.</p>',
				progress: '{{percentage}}%'
			},
			messages: {
				ready: '<span class="glyphicon glyphicon-ok"></span>File is ready. Share this link: <span class="link">{{link}}</span>',
				file: '<span class="glyphicon glyphicon-ok"></span>File is ready. <a target="_blank" href="{{url}}">Click here to download!</a>'
			}
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
			var body = $(document.body);
			var hoverActive = 0;

			var toggleHover = function(e) {
				_options.dropArea.reference.toggleClass(_options.dropArea.classes.hover);
			};

			var stopEvent = function(e) {
				e.preventDefault();
				e.stopPropagation();
			};

			body.on('dragover', stopEvent);
			body.on('dragenter', toggleHover);
			body.on('dragleave', toggleHover);
			body.on('drop', function(e) {
				toggleHover(e);
				stopEvent(e);
				_host.handleDrop(e);
			});

			window.onunload = window.onbeforeunload = function() {
				var session = _session.reference;

				if (session !== null && !session.destroyed) {
					session.destroy();
				}
			};

			_options.dropArea.reference.toggleClass(_options.dropArea.classes.ready);
			_setText('status', 'drop');
		},

		// Initiate a session when a file is dropped.
		handleDrop: function(e) {
			var dataTransfer = e.originalEvent.dataTransfer;

			if(dataTransfer && dataTransfer.files.length) {
				var file = dataTransfer.files[0];

				_session.file = file;

				_setText('message', 'ready', {
					'link': document.URL + '#' + _session.id
				});
				_message.show();

				this.listenForPeer(file);
			}
		},

		// Listen for incoming connection and send file when established.
		listenForPeer: function(file) {
			var callback;

			_session.reference.on('connection', function(connection) {
				if(connection.label && connection.label === 'file') {
					callback = function() {
						_setText('status', 'sending');
						_host.setProgress(connection, file.size);
						_message.hide();

						connection.send({
							file: file,
							name: file.name,
							size: file.size,
							type: file.type
						});
					};
				}

				if(connection.label && connection.label === 'text') {
					callback = function() {
						_listen(connection, _handleText);
					};
				}

				_handleConnection(connection, callback);
			});
		},

		// Check file transfer progress and push updates to peer.
		setProgress: function(connection, filesize) {
			var bufferedAmount = 0;
			var previous = 0;
			var percentage = 1;

			var progress = setInterval(function() {
				bufferedAmount = connection.getBufferedAmount();
				percentage = Math.floor(100 - ((bufferedAmount / filesize) * 100));

				if(percentage > previous) {
					previous = percentage;

					_setText('status', 'progress', {
						percentage: percentage
					});

					if(_session.textConnection !== null) {
						_session.textConnection.send({
							message: 'progress',
							replacements: {
								percentage: percentage
							}
						});
					}
				}

				if(percentage === 100) {
					clearInterval(progress);
					_setText('status', 'success');
				}
			}, 50);
		}
	};

	var _peer = {
		// Connect to host if we have a hash reference to their ID.
		connectToHost: function(peerId) {
			var timeout;
			var fileConnection = _session.reference.connect(peerId, { label: 'file' });
			var textConnection = _session.reference.connect(peerId, { label: 'text' });

			_setText('status', 'connecting');

			// If we can't connect within defined time frame then message user and destroy session.
			timeout = setTimeout(function() {
				_setText('status', 'error');
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

				if(_session.textConnection !== null) {
					_session.textConnection.on('close', function() {
						_setText('message', 'file', {
							url: url
						});
						_message.show();
					});

					_session.textConnection.close();
				} else {
					_setText('message', 'file', {
						url: url
					});
					_message.show();
				}
			}
		}
	};

	var _message = {
		toggle: function() {
			_options.message.reference.toggleClass(_options.message.classes.open);
		},

		show: function() {
			_options.message.reference.addClass(_options.message.classes.open);
		},

		hide: function() {
			_options.message.reference.removeClass(_options.message.classes.open);
		}
	},

	// Create a peer session.
	_createSession = function(callback) {
		var session = new Peer({
			key: _options.key
		});

		_setText('status', 'initializing');

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

				_setText('status', 'established');
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
			_setText('status', 'error');
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
	_setText = function(type, identifier, replacements) {
		var type = type || 'status';
		var namespace = (type === 'status' ? _options.text.statuses : _options.text.messages);
		var text = namespace[identifier];

		if(!text || typeof text !== 'string') {
			return false;
		}

		if(replacements !== undefined && typeof replacements === 'object') {
			var placeholders = text.match(/{{[\w]+}}/g) || [];
			var current;
			var replacement;

			for(var i = 0, length = placeholders.length; i < length; i++) {
				current = placeholders[i];
				replacement = replacements[current.replace(/\W/g, '')];

				if(replacement) {
					text = text.replace(current, replacement);
				}
			}
		}

		type === 'status' ? _options.dropArea.status.html(text) : _options.message.reference.html(text);
	}

	// Receive messages from host and update the UI of status.
	_handleText = function(data) {
		if(data && data.message) {
			_setText('status', data.message, data.replacements);
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
}(jQuery, document);

// Kick out the jams.
$(document).ready(function() {
	var hash = window.location.hash;

	if(hash && typeof hash === 'string' && hash.length > 0) {
		dropsend.initiatePeer(hash.replace(/\W/g, ''));
	} else {
		dropsend.initiateHost();
	}
});