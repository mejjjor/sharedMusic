var util = require('util');
var webrtc = require('webrtcsupport');
var WildEmitter = require('wildemitter');
var mockconsole = require('mockconsole');
var localMedia = require('localmedia');
var Peer = require('./peer');


function WebRTC(opts) {
    var self = this;
    var options = opts || {};
    var config = this.config = {
            debug: false,
            // makes the entire PC config overridable
            peerConnectionConfig: {
                iceServers: [{url:'stun:stun01.sipphone.com'},
{url:'stun:stun.ekiga.net'},
{url:'stun:stun.fwdnet.net'},
{url:'stun:stun.ideasip.com'},
{url:'stun:stun.iptel.org'},
{url:'stun:stun.rixtelecom.se'},
{url:'stun:stun.schlund.de'},
{url:'stun:stun.l.google.com:19302'},
{url:'stun:stun1.l.google.com:19302'},
{url:'stun:stun2.l.google.com:19302'},
{url:'stun:stun3.l.google.com:19302'},
{url:'stun:stun4.l.google.com:19302'},
{url:'stun:stunserver.org'},
{url:'stun:stun.softjoys.com'},
{url:'stun:stun.voiparound.com'},
{url:'stun:stun.voipbuster.com'},
{url:'stun:stun.voipstunt.com'},
{url:'stun:stun.voxgratia.org'},
{url:'stun:stun.xten.com'},
{
    url: 'turn:numb.viagenie.ca',
    credential: 'muazkh',
    username: 'webrtc@live.com'
},
{
    url: 'turn:192.158.29.39:3478?transport=udp',
    credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
    username: '28224511:1379330808'
},
{
    url: 'turn:192.158.29.39:3478?transport=tcp',
    credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
    username: '28224511:1379330808'
}]
            },
            peerConnectionConstraints: {
                optional: []
            },
            receiveMedia: {
                offerToReceiveAudio: 1,
                offerToReceiveVideo: 1
            },
            enableDataChannels: true
        };
    var item;

    // expose screensharing check
    this.screenSharingSupport = webrtc.screenSharing;

    // We also allow a 'logger' option. It can be any object that implements
    // log, warn, and error methods.
    // We log nothing by default, following "the rule of silence":
    // http://www.linfo.org/rule_of_silence.html
    this.logger = function () {
        // we assume that if you're in debug mode and you didn't
        // pass in a logger, you actually want to log as much as
        // possible.
        if (opts.debug) {
            return opts.logger || console;
        } else {
        // or we'll use your logger which should have its own logic
        // for output. Or we'll return the no-op.
            return opts.logger || mockconsole;
        }
    }();

    // set options
    for (item in options) {
        this.config[item] = options[item];
    }

    // check for support
    if (!webrtc.support) {
        this.logger.error('Your browser doesn\'t seem to support WebRTC');
    }

    // where we'll store our peer connections
    this.peers = [];

    // call localMedia constructor
    localMedia.call(this, this.config);

    this.on('speaking', function () {
        if (!self.hardMuted) {
            // FIXME: should use sendDirectlyToAll, but currently has different semantics wrt payload
            self.peers.forEach(function (peer) {
                if (peer.enableDataChannels) {
                    var dc = peer.getDataChannel('hark');
                    if (dc.readyState != 'open') return;
                    dc.send(JSON.stringify({type: 'speaking'}));
                }
            });
        }
    });
    this.on('stoppedSpeaking', function () {
        if (!self.hardMuted) {
            // FIXME: should use sendDirectlyToAll, but currently has different semantics wrt payload
            self.peers.forEach(function (peer) {
                if (peer.enableDataChannels) {
                    var dc = peer.getDataChannel('hark');
                    if (dc.readyState != 'open') return;
                    dc.send(JSON.stringify({type: 'stoppedSpeaking'}));
                }
            });
        }
    });
    this.on('volumeChange', function (volume, treshold) {
        if (!self.hardMuted) {
            // FIXME: should use sendDirectlyToAll, but currently has different semantics wrt payload
            self.peers.forEach(function (peer) {
                if (peer.enableDataChannels) {
                    var dc = peer.getDataChannel('hark');
                    if (dc.readyState != 'open') return;
                    dc.send(JSON.stringify({type: 'volume', volume: volume }));
                }
            });
        }
    });

    // log events in debug mode
    if (this.config.debug) {
        this.on('*', function (event, val1, val2) {
            var logger;
            // if you didn't pass in a logger and you explicitly turning on debug
            // we're just going to assume you're wanting log output with console
            if (self.config.logger === mockconsole) {
                logger = console;
            } else {
                logger = self.logger;
            }
            logger.log('event:', event, val1, val2);
        });
    }
}

util.inherits(WebRTC, localMedia);

WebRTC.prototype.createPeer = function (opts) {
    var peer;
    opts.parent = this;
    peer = new Peer(opts);
    this.peers.push(peer);
    return peer;
};

// removes peers
WebRTC.prototype.removePeers = function (id, type) {
    this.getPeers(id, type).forEach(function (peer) {
        peer.end();
    });
};

// fetches all Peer objects by session id and/or type
WebRTC.prototype.getPeers = function (sessionId, type) {
    return this.peers.filter(function (peer) {
        return (!sessionId || peer.id === sessionId) && (!type || peer.type === type);
    });
};

// sends message to all
WebRTC.prototype.sendToAll = function (message, payload) {
    this.peers.forEach(function (peer) {
        peer.send(message, payload);
    });
};

// sends message to all using a datachannel
// only sends to anyone who has an open datachannel
WebRTC.prototype.sendDirectlyToAll = function (channel, message, payload) {
    this.peers.forEach(function (peer) {
        if (peer.enableDataChannels) {
            peer.sendDirectly(channel, message, payload);
        }
    });
};

module.exports = WebRTC;
