Rules = new Mongo.Collection("rules");
Rooms = new Mongo.Collection("rooms");

if (Meteor.isClient) {
  Session.set("page", "game");
  Session.set("room", "");
  Session.set("name", "");

  Template.body.helpers({
    isAbout: function() {
      return Session.get("page") === "about";
    },
    isGame: function() {
      return Session.get("page") === "game";
    }
  });

  Template.body.events({
    'click .nav li': function (event) {
      var lis = document.querySelectorAll(".nav li");
      Array.prototype.forEach.call(lis, function(elem) {
        elem.classList.remove("active");
      });
      event.currentTarget.classList.add("active");
      Session.set("page", event.currentTarget.getAttribute("page"));
    }
  });

  Template.about.helpers({
    rules: function() {
      return Rules.find({});
    }
  });

  Template.game.helpers({
    inRoom: function() {
      return Session.get("room") != "";
    },

    getRoom: function() {
      return Meteor.call("getRoom", Session.get("room"));
    }
  });

  Template.room.helpers({
    name: function() {
      return Session.get("room");
    },
    members: function() {
      var rooms = Rooms.find({name:Session.get("room")}).fetch();
      if (rooms.length > 0) {
        return rooms[0].members;
      }
    },
    requests: function() {
      var rooms = Rooms.find({name:Session.get("room")}).fetch();
      if (rooms.length > 0 && rooms[0].owner == Session.get("name")) {
        return rooms[0].requests;
      }
    },
    isMember: function() {
      var rooms = Rooms.find({name:Session.get("room")}).fetch();
      if (rooms.length > 0) {
        return rooms[0].members.indexOf(Session.get("name")) > -1;
      }
    },
    requestExists: function() {
      var rooms = Rooms.find({name:Session.get("room")}).fetch();
      if (rooms.length > 0) {
        return rooms[0].requests.indexOf(Session.get("name")) > -1;
      }
    }
  });

  Template.member.helpers({
    owner: function() {
      var rooms = Rooms.find({name:Session.get("room")}).fetch();
      if (rooms.length > 0) {
        return rooms[0].owner === Session.get("name");
      }
    },
    isSelf: function() {
      return this.valueOf() === Session.get("name");
    }
  })

  Template.request.events({
    "click .accept": function(event) {
      Meteor.call("approveRequest", Session.get("name"), Session.get("room"), event.currentTarget.getAttribute("name"));
    },
    "click .delete": function(event) {
      Meteor.call("deleteRequest", Session.get("name"), Session.get("room"), event.currentTarget.getAttribute("name"));
    }
  });

  Template.member.events({
    "click .delete": function(event) {
      var player = event.currentTarget.getAttribute("name");
      if (player == Session.get("name")) {
        Meteor.call("leaveRoom", Session.get("name"), Session.get("room"));
        Session.set("room", "")
      } else {
        Meteor.call("kick", Session.get("name"), Session.get("room"), event.currentTarget.getAttribute("name"));
      }
    }
  })

  Template.game.events({
    "submit .join-room": function (event) {
      // Prevent default browser form submit
      event.preventDefault();
 
      var name = event.target.name.value;
      var roomName = event.target.roomName.value;

      Meteor.call("joinRoom", name, roomName);

      Session.set("room", roomName);
      Session.set("name", name);
      event.target.name.value = ""
      event.target.roomName.value = "";
    }
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    var rules = Rules.find({}).fetch()
    if (rules.length === 0) {
      Rules.insert({
        text: "Each turn you can :",
        subrules: ["take money", "kill", "power"]
      })
    }

    Rooms.remove({});
  });
}

Meteor.methods({
  joinRoom: function(player, roomName) {
    var rooms = Rooms.find({name:roomName}).fetch();
    if (rooms.length > 0 && (rooms[0].members.indexOf(player) == -1)) {
      var newRoom = rooms[0];
      if (!newRoom.gameStarted) {
        newRoom.requests.push(player)
        Rooms.update({name: roomName}, newRoom)
      } else {
        throw new Meteor.Error("non-authorized")
      }
    } else if (rooms.length === 0){
      Rooms.insert({
          name: roomName,
          owner: player,
          members: [player],
          requests: [],
          gameStarted: false,
          alive: [player],
          createdAt: new Date()
        });
    }
  },

  getRequests: function(roomName) {
    var rooms = Rooms.find({name:roomName}).fetch();
    if (rooms.length > 0) {
      return rooms[0].requests;
    }
  },

  getMembers: function(roomName) {
    var rooms = Rooms.find({name:roomName}).fetch();
    if (rooms.length > 0) {
      return rooms[0].members;
    }
  },

  approveRequest: function(owner, roomName, request) {
    var rooms = Rooms.find({name:roomName}).fetch();
    if (rooms.length > 0) {
      if (owner === rooms[0].owner) {
        var index = rooms[0].requests.indexOf(request);
        if (index > -1){
          rooms[0].requests.splice(index, 1);
        }
        if (rooms[0].members.indexOf(request) == -1){
          rooms[0].members.push(request)
          rooms[0].alive.push(request)
        }
        Rooms.update({name:roomName}, rooms[0]);
      }
    }
  },

  deleteRequest: function(owner, roomName, request) {
    var rooms = Rooms.find({name:roomName}).fetch();
    if (rooms.length > 0) {
      if (owner === rooms[0].owner) {
        var index = rooms[0].requests.indexOf(request);
        if (index > -1){
          rooms[0].requests.splice(index, 1);
        }
        Rooms.update({name:roomName}, rooms[0]);
      }
    }
  },

  kick: function(owner, roomName, member) {
    var rooms = Rooms.find({name:roomName}).fetch();
    if (rooms.length > 0) {
      if (owner === rooms[0].owner) {
        var index = rooms[0].members.indexOf(member);
        if (index > -1){
          rooms[0].members.splice(index, 1);
        }
        if (rooms[0].members.length > 0){
          Rooms.update({name:roomName}, rooms[0]);
        } else {
          Rooms.remove({name:roomName})
        }
      }
    }
  },

  leaveRoom: function(player, roomName) {
    var rooms = Rooms.find({name:roomName}).fetch();
    if (rooms.length > 0) {
      var index = rooms[0].members.indexOf(player);
      if (index > -1) {
        rooms[0].members.splice(index, 1);
        if (rooms[0].owner == player && rooms[0].members.length > 0) {
          rooms[0].owner = rooms[0].members[0];
        }
      }
      if (rooms[0].members.length > 0){
        Rooms.update({name:roomName}, rooms[0]);
      } else {
        Rooms.remove({name:roomName})
      }
    }
  },

  getRoom: function(roomName) {
    var rooms = Rooms.find({name:roomName}).fetch();
    if (rooms.length > 0) {
      return rooms[0];
    }
  },

  isOwner: function(player, roomName) {
    var rooms = Rooms.find({name:roomName}).fetch();
    if (rooms.length > 0) {
      return rooms[0].owner === player;
    }
  }
});
