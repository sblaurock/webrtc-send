var linkify = function($, document) {
	var _options = {
		host: 'linkify-server.herokuapp.com',
		port: '443',
		secure: true,
		connectTimeout: 20000,
		config: {'iceServers': [
			{ url: 'stun:stun.l.google.com:19302' },
		]},
		supported: [
			'Firefox',
			'Chrome'
		],
		text: {
			fadeDuration: 150,
			fadeClass: 'invisible',
			statuses: {
				drag: 'Drag a file here...',
				drop: 'Awesome, now drop it.',
				waiting: 'Waiting for peer...',
				initializing: '<p class="loading">Loading...</p>',
				connecting: 'Connecting to peer...',
				established: 'Connection established.',
				success: 'File transfer complete.',
				error: '<p class="error">Attempt to connect failed.</p>',
				progress: '<p class="percentage">{{percentage}}</p>'
			},
			messages: {
				ready: '<span class="icon">&#10004;</span>File is ready. Click to copy link to clipboard: <span id="share" class="link">{{link}}</span>',
				file: '<span class="icon">&#10004;</span>File is ready! {{type}} ({{size}}) - <a target="_blank" class="link" href="{{url}}">Click here to download.</a>',
				copied: '<span class="icon">&#10004;</span>Link has been copied to your clipboard.',
				unsupported: '<span class="error icon">&#9888;</span>Unfortunately, browser support is currently limited to: {{browsers}}.'
			}
		},
		dropArea: {
			reference: $('#droparea'),
		},
		status: {
			reference: $('#status'),
			inner: $('#status-inner'),
			text: $('#status-text'),
			classes: {
				paused: 'paused',
				ready: 'ready',
				hover: 'hover',
				waiting: 'waiting',
				transferring: 'transferring',
				success: 'success'
			}
		},
		message: {
			reference: $('#message'),
			text: $('#message-text'),
			classes: {
				open: 'open'
			}
		},
		clipboard: {
			id: 'share',
			swfPath: '/resources/clipboard.swf'
		},
		progress: {
			reference: $('#progress'),
			first: $('#progress-first'),
			second: $('#progress-second'),
			animationDuration: 50
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
			var dropArea = _options.dropArea.reference;
			var hoverActive = false;
			var previousEvent;
			var body = $('body');

			var toggleHover = function(e) {
				// Bug: Firefox sometimes fires 'dragenter' twice (mzl.la/19VyMRn).
				if(e.type === previousEvent) {
					return false;
				}

				hoverActive ? _host.setStatusState('ready') : _host.setStatusState('hover')

				previousEvent = e.type;
				hoverActive = !hoverActive;
			};

			var stopEvent = function(e) {
				e.preventDefault();
				e.stopPropagation();
			};

			body.on('dragover', stopEvent);
			body.on('dragenter', stopEvent);
			body.on('dragleave', stopEvent);
			body.on('drop', stopEvent);
			dropArea.on('dragover', stopEvent);
			dropArea.on('dragenter', toggleHover);
			dropArea.on('dragleave', toggleHover);
			dropArea.on('drop', function(e) {
				dropArea.remove();
				_host.handleDrop(e);
			});

			window.onunload = window.onbeforeunload = function() {
				var session = _session.reference;

				if (session !== null && !session.destroyed) {
					session.destroy();
				}
			};

			this.setStatusState('ready');
			_options.dropArea.reference.show();
		},

		// Initiate a session when a file is dropped.
		handleDrop: function(e) {
			var dataTransfer = e.originalEvent.dataTransfer;

			if(dataTransfer && dataTransfer.files.length) {
				var file = dataTransfer.files[0];

				_session.file = file;

				_host.setStatusState('waiting');
				_host.clipboard.setup();
				_host.listenForPeer(file);
				_message.show('ready', {
					'link': document.URL + '#' + _session.id
				});
			}
		},

		// Listen for incoming connection and send file when established.
		listenForPeer: function(file) {
			var callback;

			_session.reference.on('connection', function(connection) {
				if(connection.label && connection.label === 'file') {
					callback = function() {
						_host.setStatusState('sending');
						_host.handleProgress(connection, file.size);

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
						// No use for this yet.
					};
				}

				_handleConnection(connection, callback);
			});
		},

		// Check file transfer progress and push updates to peer.
		handleProgress: function(connection, filesize) {
			var previous = 0;

			_options.progress.first.show();

			var progress = setInterval(function() {
				var bufferedAmount = connection.dataChannel.bufferedAmount || 0;
				var percentage = Math.floor(100 - ((bufferedAmount / filesize) * 100));

				if(percentage > previous) {
					_setProgress(percentage);

					if(_session.textConnection !== null) {
						_session.textConnection.send({
							message: 'progress',
							percentage: percentage
						});
					}

					previous = percentage;
				}

				if(percentage >= 100) {
					clearInterval(progress);
					_host.setStatusState('success');
					_message.hide();
					_host.clipboard.destroy();
				}
			}, 50);
		},

		// Defines clipboard functionality for share link.
		clipboard: {
			setup: function() {
				var instance;

				var checkElementExists = setInterval(function() {
					var element = $('#' + _options.clipboard.id);

					if(!element.length) {
						return;
					}

					clearInterval(checkElementExists);

					instance = new ZeroClipboard(_options.message.reference, { 
						moviePath: _options.clipboard.swfPath,
						forceHandCursor: true,
					});

					instance.on('dataRequested', function() {
						instance.setText(element.html());
					});

					instance.on("wrongFlash noFlash", function() {
						this.destroy();
					});

					instance.on('complete', function() {
						_setText('message', 'copied');
					});
				}, 50);
			},
			destroy: function() {
				try {
					ZeroClipboard.destroy();
				} catch (e) {
					delete ZeroClipboard.prototype._singleton;
				}
			}
		},

		// Sets various UI states of 'status' section.
		setStatusState: function(state) {
			var status = _options.status;

			switch(state) {
				case 'ready':
					status.reference.addClass(status.classes.ready);
					status.reference.toggleClass(status.classes.paused);
					status.reference.removeClass(status.classes.hover);
					status.inner.toggleClass(status.classes.paused);
					_setText('status', 'drag');
					break;

				case 'hover':
					status.reference.toggleClass(status.classes.paused);
					status.reference.addClass(status.classes.hover);
					status.inner.toggleClass(status.classes.paused);
					_setText('status', 'drop');
					break;

				case 'waiting':
					status.reference.addClass(status.classes.waiting);
					status.reference.removeClass(status.classes.hover);
					_setText('status', 'waiting');
					break;

				case 'sending':
					status.reference.removeClass(status.classes.ready);
					status.reference.removeClass(status.classes.waiting);
					status.reference.addClass(status.classes.transferring);
					break;

				case 'success':
					status.reference.removeClass(status.classes.transferring);
					status.reference.addClass(status.classes.success);
					_setText('status', 'success');
					break;
			}
		}
	};

	var _peer = {
		// Connect to host if we have a hash reference to their ID.
		connectToHost: function(peerId) {
			var timeout;
			var fileConnection = _session.reference.connect(peerId, { label: 'file' });
			var textConnection = _session.reference.connect(peerId, { label: 'text' });

			this.setStatusState('ready');

			// If we can't connect within defined time frame then message user and destroy session.
			timeout = setTimeout(function() {
				_setText('status', 'error');
				_session.reference.destroy();

				return;
			}, _options.connectTimeout);

			_handleConnection(fileConnection, function() {
				clearTimeout(timeout);
				_listen(fileConnection, _peer.handleFile);
			});

			_handleConnection(textConnection, function() {
				_options.progress.first.show();
				_listen(textConnection, _peer.handleProgress);
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
						_setProgress(100);
						_peer.setStatusState('success');
						_message.show('file', {
							url: url,
							size: _formatFileSize(data.size),
							type: data.type,
						});
					});

					_session.textConnection.close();
				} else {
					_message.show('file', {
						url: url
					});
				}
			}
		},

		// Sets various UI states of 'status' section.
		setStatusState: function(state) {
			var status = _options.status;

			switch(state) {
				case 'ready':
					status.reference.addClass(status.classes.ready);
					_setText('status', 'connecting');
					break;

				case 'established':
					status.reference.removeClass(status.classes.ready);
					status.reference.addClass(status.classes.transferring);
					_setText('status', 'established');
					break;

				case 'success':
					status.reference.removeClass(status.classes.transferring);
					status.reference.addClass(status.classes.success);
					_setText('status', 'success');
					break;
			}
		},

		// Receive messages from host and update the UI of status.
		handleProgress: function(data) {
			if(data && data.message && data.message === 'progress') {
				_setProgress(data.percentage);
			}
		}
	};

	var _message = {
		toggle: function() {
			_options.message.reference.toggleClass(_options.message.classes.open);
		},

		show: function(text, replacements) {
			if(text && typeof text === 'string') {
				_setText('message', text, replacements, true);
			}

			_options.message.reference.addClass(_options.message.classes.open);
		},

		hide: function() {
			_options.message.reference.removeClass(_options.message.classes.open);
		}
	};

	// Returns a boolean indicating the users browser support.
	var _isSupported = function() {
		return $.inArray(util.browser, _options.supported) !== -1 && util.supports.data;
	};

	// Returns a human readable filesize.
	var _formatFileSize = function(filesize) {
		var units = ['bytes', 'KB', 'MB', 'GB'];
		var magnitude = 0;

		while(filesize >= 1024) {
			filesize /= 1024;
			magnitude++;
		}

		return filesize.toFixed(1) + ' ' + units[magnitude];
	};

	// Create a peer session.
	var _createSession = function(callback) {
		if(_isSupported()) {
			var session = new Peer(util.randomToken(), {
				host: _options.host,
				port: _options.port,
				secure: _options.secure,
				config: _options.config
			});

			_setText('status', 'initializing');

			session.on('open', function(id) {
				_session.id = id;
				_session.reference = session;

				if(typeof callback === 'function') {
					callback();
				}
			});
		} else {
			_message.show('unsupported', {
				browsers: _options.supported.join(', ')
			});
		}
	};

	// Bind connection handler.
	var _handleConnection = function(connection, callback) {
		connection.on('open', function() {
			if(connection.label && connection.label === 'file') {
				_session.fileConnection = connection;

				_peer.setStatusState('established');
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
	var _listen = function(connection, callback) {
		connection.on('data', function(data) {
			if(typeof callback === 'function') {
				callback(data);
			}
		});
	};

	// Sets the circular progress indicator to the correct position.
	var _setProgress = function(percentage) {
		var first = _options.progress.first;
		var second = _options.progress.second;
		var setRotation = function(element, value) {
			element.css('-webkit-transform', 'rotate(' + value + 'deg)');
			element.css('transform', 'rotate(' + value + 'deg)');
		};

		_setText('status', 'progress', {
			percentage: percentage
		}, true);

		if(!_setProgress.overHalf && percentage >= 50) {
			setRotation(first, 360);

			first.one('webkitTransitionEnd transitionend', function(e) {
				if(!_setProgress.overHalf) {
					_setProgress.overHalf = true;

					_options.progress.reference.addClass('half');
				}
			});

			// Fallback - We need to be sure that 'addClass' happens.
			setTimeout(function() {
				if(!_setProgress.overHalf) {
					_setProgress.overHalf = true;

					_options.progress.reference.addClass('half');
				}
			}, _options.progress.animationDuration * 2);
		}

		if(percentage < 50) {
			degrees = 180 + Math.floor(180 * (percentage * 2 / 100));

			setRotation(first, degrees);
		} else {
			degrees = Math.floor(180 * ((percentage - 50) * 2 / 100));

			setRotation(second, degrees);
		}

		// In progress...
		first.css('background-color', 'rgba(41, 143, ' + percentage * 2 + ', 1)');
		second.css('background-color', 'rgba(41, 143, ' + percentage * 2 + ', 1)');
	};

	// Display a message to the user.
	var _setText = function(type, identifier, replacements, noanimate) {
		var type = type || 'status';
		var namespace = (type === 'status' ? _options.text.statuses : _options.text.messages);
		var container = (type === 'status' ? _options.status.text : _options.message.text);
		var text = namespace[identifier];
		var noanimate = !!noanimate || false;

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

		if(noanimate) {
			container.html(text);
		} else {
			container.addClass(_options.text.fadeClass);
			setTimeout(function() {
				container.html(text);
				container.removeClass(_options.text.fadeClass);
			}, _options.text.fadeDuration);
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
		linkify.initiatePeer(hash.replace(/\W/g, ''));
	} else {
		linkify.initiateHost();
	}
});