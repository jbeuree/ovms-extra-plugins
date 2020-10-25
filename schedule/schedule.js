/*
 * /store/scripts/lib/schedule.js
 * 
 * Module plugin:
 *  Schedule driven climate control.
 * 
 * Version 1.0
 * 
 * Enable:
 *  - Install this script as /store/scripts/lib/schedule.js
 *  - Add to /store/scripts/ovmsmain.js:
 *        schedule = require("lib/schedule");
 *  - script reload
 * 
 * Config:
 *  - usr schedule.enabled         Master on/off switch
 *  - usr schedule.startTimes      Times to initiate climate control  { startTimes: [ time1, time2, ... ] }
 * 
 */

var cfg = {
  "enabled":          false,
  "startTimes":       { "times": [ ] },
};

var state = {
  monitoring:         false,
  monitoredEvents:    { "events": [ ] },
};

// Read config:
function readconfig() {
  // Start by clearing out any current schedules and replace with the new set
  removeAllSchedules()

  Object.assign(cfg, OvmsConfig.GetValues("usr", "schedule."));
  if (cfg.enabled == "true") {
    cfg.enabled = true
  } else {
    cfg.enabled = false
  }
  cfg.startTimes = JSON.parse(cfg.startTimes)

  // Only enable the new config if enable is set
  if (cfg.enabled) {
    enableAllSchedules()
  }
}

function removeAllSchedules() {
  var len = state.monitoredEvents.events.length;
  for (var i = 0; i < len; i++) {
    if (state.monitoredEvents.events[i].id != "") {
      PubSub.unsubscribe(state.monitoredEvents.events[i].id)
    }
  }
  state.monitoredEvents.events = []
}

function enableAllSchedules() {
  enableFutureSchedules()
}

function enableFutureSchedules() {
  var len = cfg.startTimes.times.length;
  for (var i = 0; i < len; i++) {
    addFutureSchedule(cfg.startTimes.times[i])
  }
}

function addFutureSchedule(timedate) {
  var now = new Date()
  // Append the current time offset to the new one so they can be compared
  var offset = ("" + now).substring(23)

  // Only add if within the next 24h
  var futureDate = new Date(timedate + offset)

  if (futureDate < now) {
    // In the past, ignore
    return
  }

  var dayAhead = new Date(now);
  dayAhead.setDate(dayAhead.getDate() + 1);  
  if (futureDate < dayAhead) {
    // It's within the next 24h, so we can get an event for it
    addSchedule(timedate.split("T")[1])
  }
}

function alreadySubscribed(eventname) {
  var index = 0
  var found = false

  while ((!found) && (index < state.monitoredEvents.events.length)) {
    found = (state.monitoredEvents.events[index].name == eventname)
  }
  return found
}

function addSchedule(time) {
  var eventname = getEventName(time)

  // Make sure it doesn't have an event already
  if (alreadySubscribed(eventname)) {
    return
  }
  var id = PubSub.subscribe(eventname, startClimateControl)
  state.monitoredEvents.events.push({ name: eventname, id: id })
}

function checkSchedulesComingSoon() {
  // Make sure all future schedules within the next 24h are handled
  enableFutureSchedules()
}

function getEventName(time) {
  var timestr = time.replace(':', '')
  return "clock." + timestr
}

function startClimateControl(msg, data) {
  // Remove the event that called this
  PubSub.unsubscribe(msg)

  // Remove the corresponding config
  var index = 0
  while ((index < cfg.startTimes.times.length) && (msg != getEventName(cfg.startTimes.times[index].split("T")[1]))) {
    ++index
  }
  if (index < cfg.startTimes.times.length) {
    cfg.startTimes.times.splice(index, 1)
    OvmsConfig.Set("usr", "schedule.startTimes", JSON.stringify(cfg.startTimes))
  }

 index = 0
  while ((index < state.monitoredEvents.events.length) && (msg != state.monitoredEvents.events[index].name)) {
    ++index
  }
  if (index < state.monitoredEvents.events.length) {
    state.monitoredEvents.events.splice(index, 1)
  }

  // Double check it's enabled and vehicle is not on before starting the climate control
  var vehicleOn = OvmsMetrics.Value("v.e.on")
  if ((cfg.enabled) && (! vehicleOn)) {
    OvmsVehicle.ClimateControl(true)
  }
}

exports.setEnabled = function(enabled) {
  OvmsConfig.Set("usr", "schedule.enabled", enabled)
}

exports.getEnabled = function() {
  if (typeof cfg.enabled === 'undefined') {
    return(false)
  } else {
    print(cfg.enabled)
  }
}

exports.setStartTimes = function(times) {
  if (times == "") {
    times = { startTimes: [] }
  }
  var startArray = times.startTimes
  

  // Copy the new start times into the saved config
  var len = startArray.length;
  var startTimes = { times: [] }
  for (var i = 0; i < len; i++) {
    startTimes.times.push(startArray[i])
  }
  OvmsConfig.Set("usr", "schedule.startTimes", JSON.stringify(startTimes))
}

exports.setConfiguration = function(enabled, scheduledTimes) {
  // Temporarily empty the cfg times - the set below will correct them. This way if only the enable is changing there won't be extra work done
  //cfg.startTimes.times = []
  exports.setEnabled(enabled)
  exports.setStartTimes(scheduledTimes)
}


exports.info = function() {
  JSON.print({ "cfg": cfg, "state": state })
}

// Init:
state.monitoring = false
cfg.startTimes.times = []
readconfig()
PubSub.subscribe("config.changed", readconfig)
PubSub.subscribe("clock.1100", enableFutureSchedules)
PubSub.subscribe("clock.2300", enableFutureSchedules)
