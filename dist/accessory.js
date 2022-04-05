"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
let hap;
const mqtt_1 = __importDefault(require("mqtt"));
class DoorLock {
    constructor(log, config, api) {
        this.log = log;
        this.api = api;
        this.deviceName = config.name;
        this.manufacturer = config.manufacturer;
        this.model = config.model;
        this.serialNumber = config.serialNumber;
        this.mqttUrl = config.mqttUrl;
        this.mqttUser = config.mqttUser;
        this.mqttPass = config.mqttPass;
        this.topicStatus = config.topicStatus;
        this.topicCommand = config.topicCommand;
        this.onCommand = config.onCommand;
        this.offCommand = config.offCommand;
        this.onValue = config.onValue;
        this.offValue = config.offValue;
        this.lastDeviceStatus = "";
        this.informationService = new hap.Service.AccessoryInformation()
            .setCharacteristic(hap.Characteristic.Manufacturer, this.manufacturer)
            .setCharacteristic(hap.Characteristic.Model, this.model)
            .setCharacteristic(hap.Characteristic.SerialNumber, this.serialNumber);
        // Service Type
        this.deviceService = new hap.Service.LockMechanism(this.deviceName);
        this.deviceService.getCharacteristic(this.api.hap.Characteristic.LockCurrentState)
            .on("get" /* GET */, this.getLockCurrentStateHandler.bind(this));
        this.deviceService.getCharacteristic(this.api.hap.Characteristic.LockTargetState)
            .on("get" /* GET */, this.getLockTargetStateHandler.bind(this))
            .on("set" /* SET */, this.setLockTargetStateHandler.bind(this));
        this.mqttOptions = {
            keepalive: 10,
            clientId: this.deviceName + "_" + (Math.random() * 10000).toFixed(0),
            protocolId: 'MQTT',
            protocolVersion: 4,
            clean: true,
            reconnectPeriod: 1000,
            connectTimeout: 30 * 1000,
            will: {
                topic: 'home/will',
                payload: this.deviceName,
                qos: 0,
                retain: false
            },
            username: this.mqttUser,
            password: this.mqttPass,
            rejectUnauthorized: false
        };
        // connect to MQTT broker
        this.mqttClient = mqtt_1.default.connect(this.mqttUrl, this.mqttOptions);
        this.setMqttEvent();
        this.log.info(this.deviceName + " plugin loaded.");
    }
    getLockCurrentStateHandler(callback) {
        callback(null, this.deviceService.getCharacteristic(this.api.hap.Characteristic.LockCurrentState).value);
    }
    getLockTargetStateHandler(callback) {
        callback(null, this.deviceService.getCharacteristic(this.api.hap.Characteristic.LockTargetState).value);
    }
    setLockTargetStateHandler(value, callback) {
        let jsonCommand;
        if (value == 0) { // OPEN
            jsonCommand = this.offCommand;
        }
        else { // CLOSE
            jsonCommand = this.onCommand;
        }
        this.mqttClient.publish(this.topicCommand, jsonCommand);
        callback(null);
    }
    setMqttEvent() {
        this.mqttClient.on("message", (topic, message) => {
            if (topic === this.topicStatus) {
                let jsonData = JSON.parse(message.toString());
                let deviceStatus = jsonData.DeviceStatus;
                if (deviceStatus != this.lastDeviceStatus) {
                    this.lastDeviceStatus = deviceStatus;
                    if (deviceStatus == this.offValue) { // OPEN
                        this.deviceService.setCharacteristic(this.api.hap.Characteristic.LockCurrentState, this.api.hap.Characteristic.LockCurrentState.UNSECURED);
                        this.deviceService.setCharacteristic(this.api.hap.Characteristic.LockTargetState, this.api.hap.Characteristic.LockTargetState.UNSECURED);
                    }
                    else { // CLOSE
                        this.deviceService.setCharacteristic(this.api.hap.Characteristic.LockCurrentState, this.api.hap.Characteristic.LockCurrentState.SECURED);
                        this.deviceService.setCharacteristic(this.api.hap.Characteristic.LockTargetState, this.api.hap.Characteristic.LockTargetState.SECURED);
                    }
                    this.log.info("Set door to : " + deviceStatus);
                }
            }
        });
        this.mqttClient.on("connect", () => {
            this.mqttClient.subscribe(this.topicStatus, (error) => {
                if (error) {
                    this.log.info("Failed to subscribe : " + this.topicStatus);
                }
            });
        });
        this.mqttClient.on("close", () => {
            this.log.info("MQTT connection closed.");
        });
    }
    /*
     * This method is optional to implement. It is called when HomeKit ask to identify the accessory.
     * Typical this only ever happens at the pairing process.
     */
    identify() {
    }
    /*
     * This method is called directly after creation of this instance.
     * It should return all services which should be added to the accessory.
     */
    getServices() {
        return [
            this.informationService,
            this.deviceService
        ];
    }
}
module.exports = (api) => {
    hap = api.hap;
    api.registerAccessory("DoorLock", DoorLock);
};
//# sourceMappingURL=accessory.js.map