

/*
 *  Created by "acrobots"
 */
'use strict';


var localVideo;
var peerConnection = [];
var roomCreated = false; 

//For mapping "RTCPeerConnection" -> "UUID"
var hashMap = {};
var uuid;
var roomNum = -1;
var allowed;
var localStream = null;
var constraints = {
        video: true,
        audio: true
    };
var peerConnectionConfig = null;

/*
var peerConnectionConfig = {
    'iceServers': [
        {'urls': 'stun:stun.services.mozilla.com'},
        {'urls': 'stun:stun.l.google.com:19302'},
    ]
};
*/


//There should be two functions 
//1.Call
//2.Share sdp packet
//Add fields like. 1. Username 2. message type 3.Status of client
    


window.onload = function(){
    
    serverConnection = new WebSocket('wss://192.168.43.151:8445');
   
    uuid = uuid();
    console.log("UUID:" + uuid);
    serverConnection.onmessage = gotMessageFromServer;
    
    serverConnection.addEventListener('open', function (event) {
 
        getExistingRooms();

    });
    trace("Done");

}


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function pageReady() {

    $("#me").dblclick(function(){
                        
                        $("#me").animate(
            {"width": "45%"},
            "fast");
                        $("#me").animate(
            {"width": "49%"},
            "slow",'easeOutBounce');
                        

                    });
                    

    $("#you").dblclick(function(){
                        
                        $("#you").animate(
            {"width": "45%"},
            "fast");
                        $("#you").animate(
            {"width": "49%"},
            "slow",'easeOutBounce');
                        

                    });
                    
   
    localVideo = document.getElementById('localVideo');

    if(localStream == null &&  navigator.mediaDevices.getUserMedia) {
        // navigator.getUserMedia({
        //     audio:false,
        //     video: {
        //         mandatory: {
        //             chromeMediaSource: 'screen' || 'desktop' || 'window'
        //     },
        //     optional: []
        // }
        // },
        // function(stream){console.log('got media stream');},
        // function(){ console.log('no stream provided'); }
        // );
        navigator.mediaDevices.getUserMedia(constraints).then(getUserMediaSuccess).catch(errorHandler);

    } else {
        alert('Your browser does not support getUserMedia API');
    }
}

function getExistingRooms(){
   
    serverConnection.send(createPacket('roomListRequest', null, uuid, null, null, 
                                        null, null, null, null, null));

}

function getUserMediaSuccess(stream) {
    localStream = stream;
    localVideo.src = window.URL.createObjectURL(stream);

    $("#me").trigger('dblclick');
    // $("#me").draggable({
    //                     stack: "div",
    //                     distance: 0
    //                   }).resizable();
    // console.log("dr set local");
}


function displayRooms(roomList) {

    var table = document.getElementById("roomList");

    for (var i = roomList.length - 1; i >= 0; i--) {
        
        if (roomList[i] == null) {
            continue;
        }

        var newRow = document.createElement("tr");
        var room = document.createElement("td");
        var join = document.createElement("td");
        var button = document.createElement("button");
        button.id = roomList[i];
        button.appendChild(document.createTextNode("JOIN"));
        
        button.onclick = function(){

            //Create Join request message and send room owner.
            serverConnection.send(  
                createPacket('joinRequest', this.id, uuid, null, 
                        null, null, null, null, null, null) 
                );
        }

        room.appendChild(document.createTextNode(roomList[i]));
        join.appendChild(button);
        newRow.appendChild(room);
        newRow.appendChild(join);
        table.appendChild(newRow);
    }
}

//Adds ICE candidate to appropriate PeerConnection object.
function addIceCandidateToPeer(signal) {

    peerCon = hashMap[signal.senderUUID];
  //  console.log("ice candidate received to "+uuid+" from "+signal.senderUUID);
    peerCon.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(errorHandler);
}

function gotMessageFromServer(message) {

    var signal = JSON.parse(message.data);
    
    console.log("message : " + signal.type);
    
    if (signal.type === 'roomListResponse') {
        
        displayRooms(signal.roomList);
        
        return;
    }
    else if(signal.type === 'joinRequest') {

        //This part will always be executed by room owner
        //Got request from other client to room ownemessager now allow or disallow
        allowed = false;

        swal({   title: "New Join Request ",   
             text: "New join request has arrived.",   
             type: "info",   
             showCancelButton: true,   
             confirmButtonColor: "#DD6B55",   
             confirmButtonText: "Yes, Allow!",   
             cancelButtonText: "No, Deny!",   
             closeOnConfirm: false,   
             closeOnCancel: true 
            }, 
             function(isConfirm){   
                
                 if (isConfirm) {     
                     swal("Permission Granted!", "Your friend will join you soon.", "success");   
                     sendRoomJoinResponse(true);
                 } 
                 else {

                    sendRoomJoinResponse(false);
                    swal("Permission Denied.");   
                 } 
            });



            function sendRoomJoinResponse(status) {
                    
                    console.log("Response from Room Owner : " + createPacket('joinResponse', roomNum, uuid, signal.senderUUID, 
                        null, null, null, null, status, null));
                    serverConnection.send(createPacket('joinResponse', roomNum, uuid, signal.senderUUID, 
                        null, null, null, null, status, null));
                    
            }
       
        return;
    }
    else if(signal.type === 'joinResponse'){

        trace("Join response !!! :" +  signal.status);
        //Join request receieved .Now perform the main logic to create several rooms and
        //peer connection objects.
        
        if(signal.status == true){
             swal({   title: "Request Accepted",   
             text: "Success !",   
             html: true 
            });

            
            roomNum = signal.roomNum;

            //Create PeerConnections and video elements.
            initPeerConnections(signal.UUIDList);

        }
        else{   
            swal("Request Denied!", "Retry sending after some time.", "error");
        }
    }
    else if(signal.type == 'notification'){ 

        console.log(signal.message);
        if(signal.status == 'InvalidRoom'){
            
            swal({   title: 'Invalid Room',   
             text: signal.message,   
             confirmButtonColor: "#DD6B55",   
             confirmButtonText: "Reload",      
             closeOnConfirm: false,   
            }, 
             function(isConfirm){   
                 location.reload(); 
            });

        }
        else if(signal.status == 'RoomExists')
        {
            swal({   title: 'Room Exists',   
             text: signal.message,   
             confirmButtonColor: "#DD6B55",   
             confirmButtonText: "Reload",      
             closeOnConfirm: false,   
            }, 
             function(isConfirm){   
                 location.reload(); 
            });
        }
        else if(signal.status == 'RoomCreated')
        {
            roomCreated=true;
        }



    }
    else if(signal.type == 'iceType'){ 

        addIceCandidateToPeer(signal);
    }
    else if(signal.type == 'sdpType'){

        console.log("Signal sdp :  " + signal.sdp);
        
        if(signal.sdp.type == 'offer') {

            //Generate answer packet and video element of "Offer".
            console.log("Recieved offer and senderUUID is "+signal.senderUUID);
            
            var peerCon = createOffererPeerConnection(signal.senderUUID);


            console.log("hashMap is as below : "+hashMap[signal.senderUUID])
            


            peerCon.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(
            
                peerCon.createAnswer().then(function (description) {
                
                    peerCon.setLocalDescription(description).then(
                            function() {
                                console.log("Answer sent to " + signal.senderUUID);
                                serverConnection.send(JSON.stringify({'type' : 'sdpType', 'roomNum' : roomNum,'sdp': description, 
                                                                      'senderUUID': uuid, 'recieverUUID' : signal.senderUUID}));
    
                                }).catch(errorHandler)            
                    }).catch(errorHandler)

            ).catch(errorHandler);
        }
        else {

            console.log("Recieved answer");
            //Recieved answer , set it as remote descrption.

            var peerCon = hashMap[signal.senderUUID];
            peerCon.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            
            
        }
    }

}


function createOffererPeerConnection(senderUUID){
    console.log("in createOffererPeerConnection");
            var peerCon = new RTCPeerConnection(peerConnectionConfig);
            peerCon.addStream(localStream);             
            hashMap[senderUUID] = peerCon;

            console.log("inserted "+senderUUID +" - "+hashMap[senderUUID]);
            peerCon.onicecandidate = gotIceCandidate;

            peerCon.oniceconnectionstatechange = function() {
                if(this.iceConnectionState == 'disconnected') {
                    console.log('Disconnected');
                    var disconnectedUUID = getPeerConnectionUUID(this);            
                    var videoElement = document.getElementById(disconnectedUUID);
                    if(document.getElementById("otherVideo").src == videoElement.src)
                    {
                        videoElement.parentNode.parentNode.removeChild(videoElement.parentNode);
                        if(document.getElementById("others").firstElementChild != null)
                            document.getElementById("otherVideo").src = document.getElementById("others").firstElementChild.firstElementChild.src;
                        else
                            document.getElementById("otherVideo").src="file://null/";
                        document.getElementById("otherVideo").load();
                        $("#you").trigger('dblclick');
                    }
                    else
                        videoElement.parentNode.parentNode.removeChild(videoElement.parentNode);
                }
            }


            peerCon.onaddstream = function(event) 
            {
                    console.log("addStream called");
                    var divElement = document.createElement("div");
                    divElement.style.display="inline-block";
                    console.log(divElement);
                    divElement.style.width="18%";
                    divElement.id="div"+senderUUID;
                    divElement.style.margin="2px 5px";
                    var videoElement = document.createElement("video");
                    videoElement.style.width = "100%";
                    videoElement.id=senderUUID;
                    videoElement.class="remoteVideos";
                    videoElement.style.borderRadius="20px";
                    videoElement.autoplay = true;
                    videoElement.src = window.URL.createObjectURL(event.stream);
                    var parentDiv = document.getElementById("others");
                    divElement.appendChild(videoElement);
                    parentDiv.appendChild(divElement);
                    videoElement.load();
                    console.log(videoElement);
                    var str = "#"+divElement.id;

                    console.log(document.getElementById("otherVideo").src);

                    if(document.getElementById("otherVideo").playing==false){
                        document.getElementById("otherVideo").src = videoElement.src;
                        $("#you").trigger('dblclick');
                    }


                    
                    
                    

                    // $(str).draggable({
                    //     stack: "div",
                    //     distance: 0
                    //   }).resizable();
                $(str).click(function(){
                        console.log("video element is clicked\n"+document.getElementById(divElement.id));
                        document.getElementById("otherVideo").src = document.getElementById(videoElement.id).src;
                        console.log(videoElement.id+" is shifted");
                        document.getElementById("otherVideo").load(); 
                        
                        $(str).animate(
            {"width": "14%"},
            "fast");
                        $(str).animate(
            {"width": "17%"},
            "slow",'easeOutBounce');
                        

                    });
                    
                    $(str).trigger('click');
                    
            };

            return peerCon;
}

//Creates offers and send it to everybody in the room. 
async function initPeerConnections(UUIDList) {

    hideDiv(false);
    while(localStream==null)
        await sleep(1000);
    console.log("localStream is "+localStream);

    console.log("initializing peer connections..."+localStream)

    for (var i = UUIDList.length - 1; i >= 0; i--) 
        {
           
            var peerCon = new RTCPeerConnection(peerConnectionConfig);
            peerCon.addStream(localStream);
            hashMap[UUIDList[i]] = peerCon ;
            peerCon.onicecandidate = gotIceCandidate;
            var otherUUID = UUIDList[i]; 
            
            peerCon.oniceconnectionstatechange = function() {
                if(this.iceConnectionState == 'disconnected') {
                    console.log('Disconnected');

                    var disconnectedUUID = getPeerConnectionUUID(this);            
                    var videoElement = document.getElementById(disconnectedUUID);
                     if(document.getElementById("otherVideo").src == videoElement.src)
                    {
                        videoElement.parentNode.parentNode.removeChild(videoElement.parentNode);
                        if(document.getElementById("others").firstElementChild != null)
                            document.getElementById("otherVideo").src = document.getElementById("others").firstElementChild.firstElementChild.src;
                        else{
                            console.log('in here');
                            document.getElementById("otherVideo").src="file://null/";
                        }
                        document.getElementById("otherVideo").load();
                        $("#you").trigger('dblclick');
                    }
                    else
                        videoElement.parentNode.parentNode.removeChild(videoElement.parentNode);                }
            }

            peerCon.onaddstream = function(event) 
            {
                    console.log("addStream called");
                    var divElement = document.createElement("div");
                    divElement.style.display="inline-block";
                    console.log(divElement);
                    divElement.style.width="18%";
                    divElement.id="div"+otherUUID;
                    divElement.style.margin="2px 5px";
                    var videoElement = document.createElement("video");
                    videoElement.style.width = "100%";
                    videoElement.id=otherUUID;
                    videoElement.class="remoteVideos";
                    videoElement.style.borderRadius="20px";
                    videoElement.autoplay = true;
                    videoElement.src = window.URL.createObjectURL(event.stream);
                    var parentDiv = document.getElementById("others");
                    divElement.appendChild(videoElement);
                    parentDiv.appendChild(divElement);
                    videoElement.load();
                    console.log(videoElement);
                    var str = "#"+divElement.id;

                   

                    console.log(document.getElementById("otherVideo").src);

                    if(document.getElementById("otherVideo").playing==false){
                        document.getElementById("otherVideo").src = videoElement.src;
                        $("#you").trigger('dblclick');
                    }
                    // $(str).draggable({
                    //     stack: "div",
                    //     distance: 0
                    //   }).resizable();
                    
                    
                    

                    $(str).click(function(){
                        console.log("video element is clicked\n"+document.getElementById(divElement.id));
                        document.getElementById("otherVideo").src = document.getElementById(videoElement.id).src;
                        console.log(videoElement.id+" is shifted");
                        document.getElementById("otherVideo").load(); 

                        $(str).animate(
            {"width": "14%"},
            "fast");
                        $(str).animate(
            {"width": "17%"},
            "slow",'easeOutBounce');
                        

                    });
                    

                    $(str).trigger('click');

            };
            

            peerCon.createOffer().then(function (description) {
                    
                    console.log("In offer callback user :"  + otherUUID) ;
                
                    peerCon.setLocalDescription(description).then(
                        function() {
                                console.log("In setLocalDescription callback " + otherUUID);
                                serverConnection.send(JSON.stringify({'type' : 'sdpType', 'roomNum' : roomNum,'sdp': description, 
                                                                      'senderUUID': uuid, 'recieverUUID' : otherUUID}));
    
                                }).catch(errorHandler);
            
                        }).catch(errorHandler);
            
            await sleep(1000);
    }
}


//Traverse the whole hashMap and find the UUID which has peerCon object
function getPeerConnectionUUID(peerCon) {
    
    for(var key in hashMap) {
      
      var value = hashMap[key];

      if(value == peerCon){
        return key;
      }

    }

    return null;
}

function gotIceCandidate(event) {
    
    if(event.candidate != null) {
        
        var recieverUUID = getPeerConnectionUUID(this);
        //console.log("ice candidate from "+uuid+" to "+recieverUUID);
        serverConnection.send(JSON.stringify({'type':'iceType', 'roomNum' : roomNum, 'senderUUID':uuid ,
                                             'recieverUUID' : recieverUUID, 'ice': event.candidate}));
    }
}

function createdDescription(description) {
        
    peerConnection.setLocalDescription(description).then(
        
        function() {
            console.log("Message sent ");

            serverConnection.send(JSON.stringify({'roomNum' : roomNum,'sdp': description, 'uuid': uuid}));
    
    }).catch(errorHandler);
}

function errorHandler(error) {
    console.log(error);
}

// Strictly speaking, it's not a real UUID, but it gets the job done here
function uuid() {
  function s4() {
    return Math.floor((1 +  Math.random()) * 0x10000).toString(16).substring(1);
  }

  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}


function generateRandom(){

    var randomNumberBetween0and10000 = Math.floor(Math.random() * 1000);
    var randomNumberBetween0and10000 =  randomNumberBetween0and10000+10000;
    var input = document.getElementById("icon_prefix");
    input.value = randomNumberBetween0and10000;

}


function validateChatRoomNumber(inputObj) {

    var spans = document.getElementsByTagName("span");
    var input = inputObj.value;
    var number = parseInt(input);
    //console.log('Changed');
    if( number>=0 && number <= 9999 ){
        spans[0].setAttribute("style","visibility:visible");   
    }else{
        spans[0].setAttribute("style","visibility:hidden");   
        return true;
    }
    return false;
}

async function roomExists(){
    var cnt = 3;
    while(roomCreated==false && cnt>0){
        await sleep(1000);
        cnt = cnt - 1;
    }
    if(roomCreated==true)
        return true;
    return false;
}


//To hide the divisions 
async function hideDiv(isOwner){

    // $('#roomPage').hide();
    //$('#callPage').show();
    var room;

    if(isOwner){
        
        console.log("I'm owner..");
        room  = document.getElementById('roomNum').value;

        if(validateChatRoomNumber(room)){
            roomNum = room;
            console.log('Valid room');
            while(serverConnection.readyState != 1)
            {
                await sleep(1000);
            }

            serverConnection.send(JSON.stringify({'type' : 'createRoom', 'roomNum' : roomNum,'senderUUID': uuid}));
    
        }
        else{
            console.log("Invalid room");
            return;
        }
    }
    else{
        console.log("I'm participant...");
    }

    if(roomExists()==false){
        return;
    } 
    swal({title:"Validating Room",text:"Just a moment please!",showConfirmButton: false,});   
    setTimeout(function(){
        swal.close();
    }, 4000);

    await sleep(4000);

    document.getElementById("roomPage").style.display = "none";
    document.getElementById("callPage").style.display = "block";
   
    pageReady();

    //console.log(roomNum + " "  + uuid);
    Materialize.toast('<span>Entered into room.</span><a class=&quot;btn-flat yellow-text&quot; href=&quot;#!&quot;>OK<a>', 1000);

}


/*
Packet Description:

1.type - joinRequest, joinResponse, roomListRequest, roomListResponse, notification
2.roomNum
3.senderUUID
4.recieverUUID
5.sdp  -
6.ice
7.UUIDList
8.roomList
9.status
10.message

*/

//Create JSON object.
function createPacket(type = null, roomNum=null, senderUUID = null, recieverUUID =null, 
                        sdp = null, ice = null, UUIDList = null, roomList = null, status=null, message = null) {

    var message = stify(
                        {
                        'type': type,
                        'roomNum' : roomNum,
                        'senderUUID' : senderUUID,
                        'recieverUUID': recieverUUID,
                        'sdp' : sdp,
                        'ice' : ice,
                        'UUIDList' : UUIDList,
                        'roomList' : roomList ,
                        'status' : status,
                        'message' : message
                        }
                        );
    return message;
}


function trace(str){
    console.log(str);
}

function stify(arg) {
    return JSON.stringify(arg);
}