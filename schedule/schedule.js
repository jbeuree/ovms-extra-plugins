/*
 * /store/scripts/lib/schedule.js
 * 
 * Module plugin:
 *  Schedule driven climate control and charging.
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
 *  - usr schedule.climateStartTimes      Times to initiate climate control  { climateStartTimes: [ time1, time2, ... ] }
 * 
 */

var cfg = {
  "enabled":          false,
  "climateStartTimes":       { "times": [ ] },
  "chargeStartTimes":        { "times": [ ] },
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

  if (typeof cfg.climateStartTimes === 'string') {
    cfg.climateStartTimes = JSON.parse(cfg.climateStartTimes)
  }
  if (typeof cfg.chargeStartTimes === 'string') {
    cfg.chargeStartTimes = JSON.parse(cfg.chargeStartTimes)
  }

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
  var len = cfg.climateStartTimes.times.length;
  for (var i = 0; i < len; i++) {
    addFutureSchedule(cfg.climateStartTimes.times[i])
  }

  len = cfg.chargeStartTimes.times.length;
  for (var i = 0; i < len; i++) {
    addFutureSchedule(cfg.chargeStartTimes.times[i])
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
    ++index
  }
  return found
}

function addSchedule(time) {
  var eventname = getEventName(time)

  // Make sure it doesn't have an event already
  if (alreadySubscribed(eventname)) {
    return
  }
  var id = PubSub.subscribe(eventname, eventHandler)
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

function eventHandler(msg, data) {
  // Remove the event that called this
  PubSub.unsubscribe(msg)

  // Determine if it is climate/charge and remove the corresponding config
  var charge = false
  var climate = false

  // Check climate first
  var index = 0
  while ((index < cfg.climateStartTimes.times.length) && (! climate)) {
    if (msg == getEventName(cfg.climateStartTimes.times[index].split("T")[1])) {
      climate = true
      cfg.climateStartTimes.times.splice(index, 1)
      OvmsConfig.Set("usr", "schedule.climateStartTimes", JSON.stringify(cfg.climateStartTimes))
    }
    ++index
  }

  // Check charge
  index = 0
  while ((index < cfg.chargeStartTimes.times.length) && (! charge)) {
    if (msg == getEventName(cfg.chargeStartTimes.times[index].split("T")[1])) {
      charge = true
      cfg.chargeStartTimes.times.splice(index, 1)
      OvmsConfig.Set("usr", "schedule.chargeStartTimes", JSON.stringify(cfg.chargeStartTimes))
    }
    ++index
  }

  index = 0
  while ((index < state.monitoredEvents.events.length) && (msg != state.monitoredEvents.events[index].name)) {
    ++index
  }
  if (index < state.monitoredEvents.events.length) {
    state.monitoredEvents.events.splice(index, 1)
  }

  // Now start some things...
  if (climate) {
    startClimateControl()
  }
  if (charge) {
    startCharging()
  }
}

function startCharging() {
  // Double check it's enabled and vehicle is not on before starting to charge
  var vehicleOn = OvmsMetrics.Value("v.e.on")
  if ((cfg.enabled) && (! vehicleOn)) {
    OvmsVehicle.ClimateControl(true)
  }
}

function startClimateControl() {
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
  }
}

exports.setClimateStartTimes = function(times) {
  if (times == "") {
    times = { startTimes: [] }
  }
  var startArray = times.startTimes

  // Copy the new start times into the saved config
  var len = startArray.length;
  var climateStartTimes = { times: [] }
  for (var i = 0; i < len; i++) {
    climateStartTimes.times.push(startArray[i])
  }
  OvmsConfig.Set("usr", "schedule.climateStartTimes", JSON.stringify(climateStartTimes))
}

exports.setChargeTimes = function(times) {
  if (times == "") {
    times = { startTimes: [] }
  }
  var startArray = times.startTimes
  

  // Copy the new start times into the saved config
  var len = startArray.length;
  var chargeStartTimes = { times: [] }
  for (var i = 0; i < len; i++) {
    chargeStartTimes.times.push(startArray[i])
  }
  OvmsConfig.Set("usr", "schedule.chargeStartTimes", JSON.stringify(chargeStartTimes))
}

exports.setConfiguration = function(enabled, scheduledTimes, chargeTimes) {
  exports.setEnabled(enabled)
  exports.setClimateStartTimes(scheduledTimes)
  exports.setChargeTimes(chargeTimes)
}


exports.info = function() {
  JSON.print({ "cfg": cfg, "state": state })
}

// Init:
state.monitoring = false
cfg.climateStartTimes.times = []
cfg.chargeStartTimes.times = []
readconfig()
PubSub.subscribe("config.changed", readconfig)
PubSub.subscribe("clock.1100", enableFutureSchedules)
PubSub.subscribe("clock.2300", enableFutureSchedules)
