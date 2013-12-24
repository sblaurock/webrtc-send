var PeerServer = require('peer').PeerServer;
var express = require('express');
var app = express();
var port = process.env.PORT || 5000;
var peer = new PeerServer({ port: 9000 });

app.use(express.static(__dirname + '/public'));
app.use(express.logger());

app.listen(port, function() {
  console.log("Listening on " + port);
});