# ovms-extra-plugins
Some additional ovms plugins

## Reminders
This provides the ability to raise a notification as a reminder to plug in. It uses a set location to determine when the vehicle is parked at the desired charge location, and uses set times to determine when the notification should be sent.
When the conditions are met, an alert/usr.reminders.plugin event will be raised.

## TPMS Monitor
This provides simple monitoring of tire pressures. As no current event framework is provided for TPMS, this plugin will periodically poll for the current tire pressures. It provides the ability to notify if pressures beyond set values, or if too large a difference is seen between the tires. As this is poll based, it is not suitable for notifying immediate problems with tire pressures, and is instead more suitable for identifying gradual leaks.
