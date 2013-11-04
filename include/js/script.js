$(document).ready(function() {
	var options = {
		dropArea: {
			reference: $('#drop'),
			hoverClass: 'hover',
			activeClass: 'active'
		}
	};

	var bindDropEvents = function() {
		var toggleActiveStop = function(e) {
			options.dropArea.reference.toggleClass(options.dropArea.hoverClass);
			stopEvent(e);
		};

		var stopEvent = function(e) {
			e.preventDefault();
			e.stopPropagation();
		};

		options.dropArea.reference.on('dragover', stopEvent);
		options.dropArea.reference.on('dragenter', toggleActiveStop);
		options.dropArea.reference.on('dragleave', toggleActiveStop);

		options.dropArea.reference.on('dragenter', function(e) {
			e.preventDefault();
			e.stopPropagation();
		});

		options.dropArea.reference.on('drop', function(e) {
			if(e.originalEvent.dataTransfer) {
				if(e.originalEvent.dataTransfer.files.length) {
					var file = e.originalEvent.dataTransfer.files[0];

					options.dropArea.reference.html('Gotcha!');
					stopEvent(e);
				}
			}
		});
	}();

	var initiatePeerSession = function() {
		var peer = new Peer({key: '4u478wggtkxzuxr'});

		peer.on('open', function(id) {
			console.log('My peer ID is: ' + id);
		});
	}();
});