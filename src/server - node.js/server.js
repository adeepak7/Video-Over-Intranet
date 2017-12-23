//Room list  request and response


const HTTPS_PORT = 8443;


const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');
const WebSocketServer = WebSocket.Server;


// Yes, SSL is required
const serverConfig = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem'),
};

// Create a server for the client html page

var handleRequest = function(request, response) {
    
    //Render the single client html file for any request the HTTP server receives
    console.log('request received: ' + request.url);
    var str = "client" + request.url;
    console.log(str);
    
    if(request.url === '/') {
        response.writeHead(200, {'Content-Type' : 'text/html'});
        response.end(fs.readFileSync('client/index.html'));

    } else if(str.indexOf(".js") !== -1) {
        response.writeHead(200, {'Content-Type': 'application/javascript'});
        response.end(fs.readFileSync(str));
    }
    else if(str.indexOf(".css") !== -1) {   
        response.writeHead(200, {'Content-Type': 'text/css'});
        response.end(fs.readFileSync(str));
    }
    else if(str.indexOf(".woff2") !== -1){
            response.writeHead(200, {'Content-Type': 'text/css'});
            response.end(fs.readFileSync(str));    
    } 
    else if(str.indexOf(".ico") !== -1){
            response.writeHead(200, {'Content-Type': 'image/ico'});
            response.end(fs.readFileSync(str));    
    }
};


var httpsServer = https.createServer(serverConfig, handleRequest);
httpsServer.listen(HTTPS_PORT);


// ----------------------------------------------------------------------------------------

var rooms = [];



//Class to represent each client.
//ws -> WebSocket, valid -> If client is allowed to join conversation.

class Client {
    constructor(ws, uuid) {
        this.ws = ws;
        this.uuid = uuid;
    }

}

//Class for Room to hold room number of all clients(WebSockets) connected to it
function Room(roomNum) {
        
    this.connected = [];
    this.pending = [];
    this.roomNum = roomNum;
    this.addConnected = function (object) {
        this.connected.push(object);
    };

    this.addPending = function (object) {
        this.pending.push(object);
    };

    //Remove client from pending list and add it to connected list.
    this.pendingToConnected = function(id) {
        
        var client = findPendingClient(this.roomNum, id);
        var foundIndex = this.pending.indexOf(client);

        if (foundIndex > - 1) {
            
            this.pending.splice(foundIndex, 1);
            this.addConnected(client);
        
        }
    }

    this.getRoomOwner = function(){
        if(this.connected[0])
            return this.connected[0];
        else{
            return null;
        }
    }
    
}


//Function to check is room already exist
function roomExists(roomNum) {
    
    for (var i = rooms.length - 1; i >= 0; i--) {
        
        if(rooms[i].roomNum == roomNum) {
            return true;
        }  
    } 
    return false;
}


//Function to find room
function getRoom(roomNum) {
    
    console.log("In get rooms:");
    for (var i = rooms.length - 1; i >= 0; i--) {
        console.log(rooms[i].roomNum + " " + roomNum);
        if(rooms[i].roomNum == roomNum) {
            return rooms[i];
        }  
    } 
    return null;
}


//Function to check   
function doesClientExistInRoom(room, uuid) {
    
    var roomMembers = room.connected;
    for (var i = roomMembers.length - 1; i >= 0; i--) {
        if(roomMembers[i].uuid == uuid)
            return true;
    }

    roomMembers = room.pending;
    for (var i = roomMembers.length - 1; i >= 0; i--) {
        if(roomMembers[i].uuid == uuid)
            return true;
    }
    return false;
}

function findPendingClient(roomNum, uuid){
    var roomMembers = getRoom(roomNum).pending;
    for (var i = roomMembers.length - 1; i >= 0; i--) {
        if(roomMembers[i].uuid == uuid)
            return roomMembers[i];
    }
    return null;
}

function findConnectedClient(roomNum, uuid){

    var roomMembers = getRoom(roomNum).connected;
    for (var i = roomMembers.length - 1; i >= 0; i--) {
        if(roomMembers[i].uuid == uuid)
            return roomMembers[i];
    }
    return null;
}


function printConnectedClients(roomNum) {
    var roomObj = getRoom(roomNum);

    console.log("Connected clients in : " + roomNum);
    for (var i = roomObj.connected.length - 1; i >= 0; i--) {

        var client = roomObj.connected[i];
        console.log('Client:' + client.uuid);   
    }
}

function printPendingClients(roomNum) {
    var roomObj = getRoom(roomNum);
    console.log("Pending clients in : " + roomNum);
    console.log('Room Number:'  + roomNum);
    for (var i = roomObj.pending.length - 1; i >= 0; i--) {

        var client = roomObj.pending[i];
        console.log('Client:' + client.uuid);   
    }
}

function getClients(roomNum) {
    
    var tmpRoom = getRoom(roomNum);
    var UUIDList = [];
    for (var i =tmpRoom.connected.length - 1; i >= 0; i--) {

       UUIDList.push(tmpRoom.connected[i].uuid);
    }
    return UUIDList;
}

function deleteRoom(roomNum) {

    //Delete room from here
    var deleteRoom =   getRoom(roomNum);
    rooms.splice(rooms.indexOf(deleteRoom), 1);
    console.log("Room Deleted");
}

// Create a server for handling websocket calls
var wss = new WebSocketServer({server: httpsServer});


wss.on('connection', function(ws) {

    ws.on('close',function(code, reason){

        console.log('connection closed - c - ' + code + ' - r - ' + reason);

        for (var i = rooms.length - 1; i >= 0; i--) {
            if(rooms[i].getRoomOwner().ws == this)
            {
                console.log('Owner UUID was ' + rooms[i].getRoomOwner().uuid);
                if(rooms[i].connected.length == 1)
                {
                    deleteRoom(rooms[i].roomNum)
                    console.log('room deleted');
                }

                else
                {
                    rooms[i].connected.splice(0,1);
                    console.log('now room owner is '+rooms[i].getRoomOwner().uuid);
                }
            }
        }


    });


    ws.on('message', function(message) {

        console.log('Message received');
        // Broadcast any received message to all clients
        var json = JSON.parse(message);
        
        if (json.type === 'roomListRequest') {
                

                trace("Room request from client");
                var roomList = [];
            
                for (var i = rooms.length - 1; i >= 0; i--) {
                    roomList.push(rooms[i].roomNum);
                }

                ws.send(
                    createPacket('roomListResponse', null, 'server', json.senderUUID, null, 
                                  null, null, roomList, null, null)
                    );
                        
                return; 
        }
        else if(json.type === 'joinRequest'){

                var roomNum = json.roomNum;
                var expectedRoom = getRoom(roomNum);
                if(expectedRoom == null) {

                    //Send notification to requester 
                    ws.send(
                        createPacket('notification', null, null, null, 
                        null, null,  null,  null, 'InvalidRoom', 'Room does not exist.')
                    );
                    return;
                }
                

                //Request to room owner for joining of room.
                // 0-th socket will always be of Owner
                var owner = expectedRoom.getRoomOwner();


                if(owner && (owner.ws.readyState === WebSocket.OPEN)) {
                    
                    //send
                    owner.ws.send(message); 
                    
                    var clientObj = new Client(ws, json.senderUUID);
                    expectedRoom.addPending(clientObj);
                    
                    printPendingClients(roomNum);
                    printConnectedClients(roomNum);
                    trace("Request send to Room owner");   
                    
                }
                else{
                    
                    //If room owner is not available then send "Request Denied".
                    ws.send(
                        createPacket('notification' , null, null, null, 
                        null, null,  null,  null, 'InvalidRoom', 'Room does not exist.')
                    );
                    deleteRoom(expectedRoom.roomNum);
                }
                return;

        }
        else if(json.type === 'joinResponse'){

                var status = json.status;
                var recieverUUID = json.recieverUUID;
                var roomNum = json.roomNum;
                var expectedRoom = getRoom(roomNum);
                var pendingClient = findPendingClient(roomNum, recieverUUID);
                
                var otherSocket = pendingClient.ws;
                
                if (status == true) {

                    //Find requester from pending list and add it to connected list.
                    //Add client to room
                    trace("Room owner accepted request");
                    json.UUIDList = getClients(roomNum);
                    
                    console.log("------"+recieverUUID +" - " + stify(json)+"-------");

                    //Sending connectedList of clients in room to the requester. 
                    if(otherSocket.readyState === WebSocket.OPEN){
                        
                        otherSocket.send(stify(json));
                        expectedRoom.pendingToConnected(recieverUUID);
                    }

                }
                else{
                    var foundIndex = expectedRoom.pending.indexOf(pendingClient);

                     if (foundIndex > - 1) {
            
                        expectedRoom.pending.splice(foundIndex, 1);
                    }
                    trace("Room owner denied request");
                    if(otherSocket.readyState === WebSocket.OPEN)
                        otherSocket.send(message);
                }
                printConnectedClients(roomNum);
                //Answer who requested for joining the room.
                return;
        }
        else if(json.type == 'createRoom') {

            var roomNum = json.roomNum;
            if(roomExists(roomNum) == false) {
                //Create new room for client
                var clientObj = new Client(ws, json.senderUUID);
                var roomObj = new Room(roomNum);
                roomObj.addConnected(clientObj);
                console.log("Room created : " + roomNum);
                //Add new room
                rooms.push(roomObj);
                ws.send(stify({'type': 'notification', 'status' : 'RoomCreated', 'message' : 'Room created successfully'}));
                
             }
             else{
                ws.send(stify({'type': 'notification', 'status' : 'RoomExists', 'message' : 'Room already exists'}));
             }
            
        }
        else if(json.type === 'iceType' || json.type === 'sdpType') {

            wss.broadcast(message);
        }

    });

});



//Broadcast message to only those are in the same room(except youself)
wss.broadcast = function(message) {
    
    console.log("In broadcast !");
    var json = JSON.parse(message);
    var roomNum = json.roomNum;

    var roomObj = getRoom(roomNum);
    console.log("In broadcast : " + roomObj);

    for (var i = roomObj.connected.length - 1; i >= 0; i--) {

        var client = roomObj.connected[i];

        if (client.uuid == json.recieverUUID)  {
            
            if(client.ws.readyState === WebSocket.OPEN){
                console.log(json.type + '  sent to ' + json.recieverUUID);
                client.ws.send(message);
            }
            else{
                console.log('Connection closed by one of the reciever....');
            }
        }
    }

};


console.log('Server running. Visit https://localhost:' + HTTPS_PORT + ' in Firefox/Chrome (note the HTTPS; there is no HTTP -> HTTPS redirect!)');

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
