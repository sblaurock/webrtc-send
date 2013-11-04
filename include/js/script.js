var bytecast = function() {
	var _options = {
		dropArea: {
			reference: $('#drop'),
			hoverClass: 'hover',
			activeClass: 'active'
		},
		copy: {
			initializing: 'Creating session...',
			created: 'Session created. Share this link:<br />',
			connecting: 'Connecting to peer...'
		}
	};

	var _session = {
		id: '',
		file: null,
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

			_options.dropArea.reference.on('dragover', stopEvent);
			_options.dropArea.reference.on('dragenter', toggleActiveStopEvent);
			_options.dropArea.reference.on('dragleave', toggleActiveStopEvent);

			_options.dropArea.reference.on('drop', function(e) {
				if(e.originalEvent.dataTransfer) {
					if(e.originalEvent.dataTransfer.files.length) {
						_session.file = e.originalEvent.dataTransfer.files[0];
						toggleActiveStopEvent(e);

						instance.initiateSession(function() {
							_options.dropArea.reference.html(_options.copy.created + document.URL + '#' + id);
							instance.listenForPeer();
						});
					}
				}
			});
		},

		// Create a peer session.
		initiateSession: function(callback) {
			var instance = this;
			var peer = new Peer({key: '4u478wggtkxzuxr'});

			_options.dropArea.reference.html(_options.copy.initializing);

			peer.on('open', function(id) {
				_session.id = id;
				_session.peer = peer;

				callback(id);
			});
		},

		// Listen for incoming connections.
		listenForPeer: function() {
			_session.peer.on('connection', function(c) {
				console.log('Connection established.');
			});
		},

		// Connect to peer if we have a hash.
		connectToPeer: function(peerId) {
			this.initiateSession(function(id) {
				_options.dropArea.reference.html(_options.copy.connecting);
				console.log(peerId, id);
			});
		}
	};
}();

// Kick out the jams.
$(document).ready(function() {
	var hash = window.location.hash;

	if(hash && typeof hash === 'string' && hash.length > 0) {
		bytecast.connectToPeer(hash.replace('#', ''));
	} else {
		bytecast.bindDropEvents();
	}
});