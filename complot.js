Rules = new Mongo.Collection("rules");

if (Meteor.isClient) {
  Session.set("page", "game")

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
  });
}
