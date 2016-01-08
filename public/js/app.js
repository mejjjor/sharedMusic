



// grab the room from the URL
var room = location.search && location.search.split('?')[1];

// create our webrtc connection
var webrtc = new SimpleWebRTC({
    // we don't do video
    localVideoEl: '',
    remoteVideosEl: '',
    // dont ask for camera access
    autoRequestMedia: false,
    // dont negotiate media
    receiveMedia: {
        mandatory: {
            OfferToReceiveAudio: false,
            OfferToReceiveVideo: false
        }
    }
});

// called when a peer is created
webrtc.on('createdPeer', function (peer) {
    console.log('createdPeer', peer);

document.getElementById("sendData").onclick = function(){
    peer.sendData({aa:"zz"});
};


    var remotes = document.getElementById('remotes');
    if (!remotes) return;
    var container = document.createElement('div');
    container.className = 'peerContainer';
    container.id = 'container_' + webrtc.getDomId(peer);

    // show the peer id
    var peername = document.createElement('div');
    peername.className = 'peerName';
    peername.appendChild(document.createTextNode('Peer: ' + peer.id));
    container.appendChild(peername);

    // show a list of files received / sending
    var filelist = document.createElement('ul');
    filelist.className = 'fileList';
    container.appendChild(filelist);

    // show a file select form
    var fileinput = document.createElement('input');
    fileinput.type = 'file';

    // send a file
    fileinput.addEventListener('change', function() {
        //fileinput.disabled = true;

        var file = fileinput.files[0];
        var sender = peer.sendFile(file);

        // create a file item
        var item = document.createElement('li');
        item.className = 'sending';

        // make a label
        var span = document.createElement('span');
        span.className = 'filename';
        span.appendChild(document.createTextNode(file.name));
        item.appendChild(span);

        span = document.createElement('span');
        span.appendChild(document.createTextNode(file.size + ' bytes'));
        item.appendChild(span);

        // create a progress element
        var sendProgress = document.createElement('progress');
        sendProgress.max = file.size;
        item.appendChild(sendProgress);

        // hook up send progress
        sender.on('progress', function (bytesSent) {
            sendProgress.value = bytesSent;
        });
        // sending done
        sender.on('sentFile', function () {
            item.appendChild(document.createTextNode('sent'));

            // we allow only one filetransfer at a time
            fileinput.removeAttribute('disabled');
        });
        // receiver has actually received the file
        sender.on('complete', function () {
            // safe to disconnect now
        });
        filelist.appendChild(item);
    }, false);
    fileinput.disabled = 'disabled';
    container.appendChild(fileinput);

    // show the ice connection state
    if (peer && peer.pc) {
        var connstate = document.createElement('div');
        connstate.className = 'connectionstate';
        container.appendChild(connstate);
        peer.pc.on('iceConnectionStateChange', function (event) {
            var state = peer.pc.iceConnectionState;
            console.log('state', state);
            container.className = 'peerContainer p2p' + state.substr(0, 1).toUpperCase()
                + state.substr(1);
            switch (state) {
            case 'checking':
                connstate.innerText = 'Connecting to peer...';
                break;
            case 'connected':
            case 'completed': // on caller side
                connstate.innerText = 'Connection established.';
                // enable file sending on connnect
                fileinput.removeAttribute('disabled');
                break;
            case 'disconnected':
                connstate.innerText = 'Disconnected.';
                break;
            case 'failed':
                // not handled here
                break;
            case 'closed':
                connstate.innerText = 'Connection closed.';

                // disable file sending
                fileinput.disabled = 'disabled';
                // FIXME: remove container, but when?
                break;
            }
        });
    }
    remotes.appendChild(container);

    // receiving an incoming filetransfer
    peer.on('fileTransfer', function (metadata, receiver) {
        console.log('incoming filetransfer', metadata);
        var item = document.createElement('li');
        item.className = 'receiving';

        // make a label
        var span = document.createElement('span');
        span.className = 'filename';
        span.appendChild(document.createTextNode(metadata.name));
        item.appendChild(span);

        span = document.createElement('span');
        span.appendChild(document.createTextNode(metadata.size + ' bytes'));
        item.appendChild(span);

        // create a progress element
        var receiveProgress = document.createElement('progress');
        receiveProgress.max = metadata.size;
        item.appendChild(receiveProgress);

        // hook up receive progress
        receiver.on('progress', function (bytesReceived) {
            receiveProgress.value = bytesReceived;
        });
        // get notified when file is done
        receiver.on('receivedFile', function (file, metadata) {
            console.log('received file', metadata.name, metadata.size);
            var href = document.createElement('a');
            href.href = URL.createObjectURL(file);
            href.download = metadata.name;
            href.appendChild(document.createTextNode('download'));
            item.appendChild(href);
            // close the channel
            receiver.channel.close();
            
            playFile(file);
        });
        filelist.appendChild(item);
    });
 peer.on('dataTransfer', function (metadata) {
    console.log('incoming datatransfer', metadata);
 });
});

// local p2p/ice failure
webrtc.on('iceFailed', function (peer) {
    var connstate = document.querySelector('#container_' + webrtc.getDomId(peer) + ' .connectionstate');
    var fileinput = document.querySelector('#container_' + webrtc.getDomId(peer) + ' input');
    console.log('local fail', connstate);
    if (connstate) {
        connstate.innerText = 'Connection failed.';
        fileinput.disabled = 'disabled';
    }
});

// remote p2p/ice failure
webrtc.on('connectivityError', function (peer) {
    var connstate = document.querySelector('#container_' + webrtc.getDomId(peer) + ' .connectionstate');
    var fileinput = document.querySelector('#container_' + webrtc.getDomId(peer) + ' input');
    console.log('remote fail', connstate);
    if (connstate) {
        connstate.innerText = 'Connection failed.';
        fileinput.disabled = 'disabled';
    }
});

function setRoom(name) {
    document.querySelector('form').remove();
    document.getElementById('subTitle').innerText =  'Link to join: ' + location.href;
    $('body').addClass('active');
}

if (room) {
    setRoom(room);
    webrtc.joinRoom(room, function (err, res) {
        console.log('joined', room, err, res);
    });
} else {
    $('form>button').attr('disabled', null);
    document.getElementById('intro').style.display = "block";
    $('form').submit(function () {
        var val = $('#sessionInput').val().toLowerCase().replace(/\s/g, '-').replace(/[^A-Za-z0-9_\-]/g, '');
        webrtc.createRoom(val, function (err, name) {
            console.log(' create room cb', arguments);
            document.getElementById('intro').style.display = "none";
            var newUrl = location.pathname + '?' + name;
            if (!err) {
                history.replaceState({foo: 'bar'}, null, newUrl);
                setRoom(name);
            } else {
                console.log(err);
            }
        });
        return false;
    });
}

function playFile(file) {

    objectUrl = URL.createObjectURL(file);
    $("#audio").prop("src", objectUrl);
    document.getElementById('audio').play();
 }


