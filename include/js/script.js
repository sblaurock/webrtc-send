var bytecast = function() {
	var _options = {
		key: '4u478wggtkxzuxr',
		dropArea: {
			reference: $('#drop'),
			hoverClass: 'hover',
			activeClass: 'active'
		},
		copy: {
			drag: 'Drag a file here...',
			initializing: 'Creating session...',
			created: 'Session created. Share this link:<br />',
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

	return {
		// Handle events around drag and drop functionality.
		bindDropEvents: function() {
			var instance = this;

			var toggleActiveStopEvent = function(e) {
				_options.dropArea.reference.toggleClass(_options.dropArea.hoverClass);
				stopEvent(e);
			};

			var stopEvent = function(e) {
				e.preventDefault();
				e.stopPropagation();
			};

			_options.dropArea.reference.html(_options.copy.drag);

			_options.dropArea.reference.on('dragover', stopEvent);
			_options.dropArea.reference.on('dragenter', toggleActiveStopEvent);
			_options.dropArea.reference.on('dragleave', toggleActiveStopEvent);

			_options.dropArea.reference.on('drop', function(e) {
				if(e.originalEvent.dataTransfer) {
					if(e.originalEvent.dataTransfer.files.length) {
						var file = e.originalEvent.dataTransfer.files[0];

						toggleActiveStopEvent(e);
						_session.file = file;

						instance.initiateSession(function(id) {
							_options.dropArea.reference.html(_options.copy.created + document.URL + '#' + id);
							instance.listenForPeer(file);
						});
					}
				}
			});
		},

		// Create a peer session.
		initiateSession: function(callback) {
			var instance = this;
			var peer = new Peer({
				key: _options.key
			});

			_options.dropArea.reference.html(_options.copy.initializing);

			peer.on('open', function(id) {
				_session.id = id;
				_session.reference = peer;

				if(typeof callback === 'function') {
					callback(id, peer);
				}
			});
		},

		// Listen for incoming connection and send file when established.
		listenForPeer: function(file) {
			_session.reference.on('connection', function(connection) {
				_options.dropArea.reference.html(_options.copy.established);
				_session.peer = connection.peer;

				connection.send(file);
			});
		},

		// Connect to host if we have a hash reference to their ID.
		connectToHost: function(peerId) {
			var instance = this;

			instance.initiateSession(function(id, reference) {
				var connection = reference.connect(peerId);

				_options.dropArea.reference.html(_options.copy.connecting);

				connection.on('open', function() {
					_options.dropArea.reference.html(_options.copy.established);
					_session.peer = peerId;

					instance.waitForData(connection);
				});

				connection.on('error', function(err) {
					_options.dropArea.reference.html(_options.copy.errorConnecting);
				});
			});
		},

		// Create link to stream data from host when available.
		waitForData: function(connection) {
			_options.dropArea.reference.html(_options.copy.waiting);

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
}();

// Kick out the jams.
$(document).ready(function() {
	var hash = window.location.hash;

	if(hash && typeof hash === 'string' && hash.length > 0) {
		bytecast.connectToHost(hash.replace(/\W/g, ''));
	} else {
		bytecast.bindDropEvents();
	}
});