import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  Characteristic,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  Logging,
  Service
} from "homebridge";

let hap: HAP;

import mqtt, { MqttClient, IClientOptions } from "mqtt";
import { config } from "process";

/*
 * Initializer function called when the plugin is loaded.
 */
export = (api: API) => {
  hap = api.hap;
  api.registerAccessory("DoorLock", DoorLock);
};

class DoorLock implements AccessoryPlugin {
  private readonly log: Logging;
  private mqttOptions: IClientOptions;
  private mqttClient: MqttClient;
  private api: API;

  private deviceService: Service;
  private informationService: Service;

  private deviceName: string;
  private mqttUrl: string;
  private mqttUser: string;
  private mqttPass: string;
  private manufacturer: string;
  private model: string;
  private serialNumber: string;
  private topicStatus: string;
  private topicCommand: string;
  private onCommand: string;
  private offCommand: string;
  private onValue: string;
  private offValue: string;

  private lastDeviceStatus: string;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
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
      .on(CharacteristicEventTypes.GET, this.getLockCurrentStateHandler.bind(this));

    this.deviceService.getCharacteristic(this.api.hap.Characteristic.LockTargetState)
      .on(CharacteristicEventTypes.GET, this.getLockTargetStateHandler.bind(this))
      .on(CharacteristicEventTypes.SET, this.setLockTargetStateHandler.bind(this));
    
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
    this.mqttClient = mqtt.connect(this.mqttUrl, this.mqttOptions);

    this.setMqttEvent();

    this.log.info(this.deviceName + " plugin loaded.");
  }

	getLockCurrentStateHandler (callback: any) {
    callback(null,this.deviceService.getCharacteristic(this.api.hap.Characteristic.LockCurrentState).value);
	}

  getLockTargetStateHandler (callback: any) {
    callback(null,this.deviceService.getCharacteristic(this.api.hap.Characteristic.LockTargetState).value);
	}

	setLockTargetStateHandler (value: CharacteristicValue, callback: any) {
    let jsonCommand: string;

    if (value == 0) { // OPEN
      jsonCommand = this.offCommand;
    }
    else { // CLOSE
      jsonCommand = this.onCommand;
    }

    this.mqttClient.publish(this.topicCommand,jsonCommand);
    callback(null);  
  }

  setMqttEvent() {
    this.mqttClient.on("message", (topic: string, message: Buffer) => {
      if (topic === this.topicStatus) {
        let jsonData = JSON.parse(message.toString());
        let deviceStatus: string = jsonData.DeviceStatus;
        
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
  identify(): void {
  }

  /*
   * This method is called directly after creation of this instance.
   * It should return all services which should be added to the accessory.
   */
  getServices(): Service[] {
    return [
      this.informationService,
      this.deviceService
    ];
  }
}
