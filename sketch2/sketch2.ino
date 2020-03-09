
/*
 * Circuits4you.com
 * mDNS example ESP8266 in Arduino IDE
 * After connecting to WiFi router enter esp8266.local in web browser
*/
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "FS.h"


// Callback function to be called when the button is pressed.
void onPressed() {
    Serial.println("Button has been pressed!");
}


void reset(){
   SPIFFS.format();
   ESP.restart();
}

const char* wifiName = NULL;
const char* wifiPass = NULL;
const char* mqtt_server = NULL;
WiFiClient espClient;
PubSubClient client(espClient);
long lastMsg = 0;
char msg[50];
int value = 0;
String id = "5e38573fe9388407d86997e1";
int pins[] = {BUILTIN_LED};
StaticJsonDocument<200> doc;
StaticJsonDocument<200> con;

ESP8266WebServer server(80);

const String postForms = "<html>\
  <head>\
    <title>ESP8266 Web Server POST handling</title>\
    <style>\
      body { background-color: #cccccc; font-family: Arial, Helvetica, Sans-Serif; Color: #000088; }\
    </style>\
  </head>\
  <body>\
    <h1>POST form data to /postform/</h1><br>\
    <form method=\"post\" enctype=\"application/x-www-form-urlencoded\" action=\"/postform/\">\
      <input placeholder=\"device id\" type=\"text\" name=\"device\" value=\"\"><br>\
      <input placeholder=\"wifi name\" type=\"text\" name=\"name\" value=\"\"><br>\
      <input placeholder=\"wifi key\" type=\"password\" name=\"pass\" value=\"\"><br>\
      <input type=\"submit\" value=\"Submit\">\
    </form>\
  </body>\
</html>";


void handleRoot() {
  Serial.println("got request for /");
  server.send(200, "text/html", postForms);
}

void handleForm() {
  Serial.println("handling post...");
  if (server.method() != HTTP_POST) {
    server.send(405, "text/plain", "Method Not Allowed");
  } else {
    String message = "POST form was:\n";
    String d;
    String n;
    String pass;
    for (uint8_t i = 0; i < server.args(); i++) {
      message += " " + server.argName(i) + ": " + server.arg(i) + "\n";
      if(server.argName(i) == "device"){
        d = server.arg(i);
      }
      if(server.argName(i) == "name"){
        n = server.arg(i);
      }
      if(server.argName(i) == "pass"){
        pass = server.arg(i);
      }
    }
        if(saveConfig(d,n,pass)){
          Serial.println("saved config");
         };
        if(loadConfig()){
        Serial.println("loaded config");
              server.send(200, "text/plain", "okay");
    
              delay(100);
        }
        Serial.println(mqtt_server);
        WiFi.softAPdisconnect (true);
    
        setup_wifi();
        setup_mqtt();
                digitalWrite(BUILTIN_LED, HIGH);

    server.send(200, "text/plain", message);
    Serial.println("post 200 ok");
    

  }
}
 
// the setup function runs once when you press reset or power the board
void setup() {
 
pinMode(0, INPUT_PULLUP);

  pinMode(BUILTIN_LED, OUTPUT);     // Initialize the BUILTIN_LED pin as an output
         digitalWrite(BUILTIN_LED, LOW);

  Serial.begin(9600);
  Serial.println("Setting up...");
  doc["id"] = id;
  //Initialize File System
  if(SPIFFS.begin()){
    Serial.println("SPIFFS Initialize....ok");
  }else{
    Serial.println("SPIFFS Initialization...failed");
  }
  Serial.println("Wiping out SPIFFS...");

  if(loadConfig()){
    Serial.println("loaded config");
  }else{
    Serial.println("failed to load config");
  };
  JsonArray switches = doc.createNestedArray("switches");
  switches.add(true);
  if(NULL!=mqtt_server){
           digitalWrite(BUILTIN_LED, HIGH);

    setup_wifi();
    setup_mqtt();
  }else{
    setup_AP();  
  }
}
 
// the loop function runs over and over again forever
void loop() {
if(digitalRead(0)==0){
reset();
}
server.handleClient();
  if (!client.connected()&&mqtt_server!=NULL) {
    reconnect();
  }
  client.loop();
}

void setup_mqtt(){
  Serial.println("mqttt");
  const char* sr = con["serverName"];
  Serial.println(sr);
  client.setServer(sr, 1883);
  client.setCallback(callback);  
  
}

bool loadConfig() {
  File configFile = SPIFFS.open("/config.json", "r");
  if (!configFile) {
    Serial.println("Failed to open config file");
    return false;
  }
  size_t size = configFile.size();
  if (size > 1024) {
    Serial.println("Config file size is too large");
    return false;
  }
  // Allocate a buffer to store contents of the file.
  std::unique_ptr<char[]> buf(new char[size]);
  // We don't use String here because ArduinoJson library requires the input
  // buffer to be mutable. If you don't use ArduinoJson, you may as well
  // use configFile.readString instead.
  configFile.readBytes(buf.get(), size);
  StaticJsonDocument<200> doc;
  auto error = deserializeJson(doc, buf.get());
  if (error) {
    Serial.println("Failed to parse config file");
    return false;
  }
  con = doc;
  // Real world application would store these values in some variables for
  // later use.
  mqtt_server = con["serverName"];
  wifiName = con["wifiName"];
  wifiPass = con["wifiPass"];
  Serial.print("Loaded serverName: ");
  return true;
}

bool saveConfig(String deviceId, String wifiName, String wifiPass) {


 StaticJsonDocument<200> doc;
  doc["serverName"] = deviceId+".local";
  doc["wifiName"] = wifiName;
  doc["wifiPass"] = wifiPass;

  File configFile = SPIFFS.open("/config.json", "w");
  if (!configFile) {
    Serial.println("Failed to open config file for writing");
    return false;
  }
  serializeJson(doc, configFile);
  return true;
}



void handleNotFound(){
  server.send(404, "text/plain", "404: Not found"); // Send HTTP status 404 (Not Found) when there's no handler for the URI in the request
}

 
void setup_wifi() {
   delay(10);
  // We start by connecting to a WiFi network
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(wifiName);
 
  WiFi.begin(wifiName, wifiPass);
 
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
 
  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());   //You can get IP address assigned to ESP
 
   if(WiFi.status() == WL_CONNECTED) //If WiFi connected to hot spot then start mDNS
  {
   // if (MDNS.begin(id)) {  //Start mDNS with name esp8266
   //   Serial.println("MDNS started");
   // }
  }
   
}


void setup_AP(){
   WiFi.disconnect(true);
   WiFi.mode(WIFI_AP);
   if(WiFi.softAP(id,"",1)){
      Serial.println("ap success");
      server.on("/", handleRoot);
      server.on("/postform/", handleForm);
      server.onNotFound(handleNotFound);        // When a client requests an unknown URI (i.e. something other than "/"), call function "handleNotFound"
      server.begin();                           //Start server
      Serial.println("HTTP server started");
   }
  
}

void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  for (int i = 0; i < length; i++) {
    Serial.print((char)payload[i]);
  }
  Serial.println();

  if(String(topic) == "penumats/handshake/reinitiate"){
    Serial.print("reinitiating");
     char buffer[512];
    size_t n = serializeJson(doc, buffer);
    client.publish("penumats/handshake/connect", buffer, n);
  }
  
  if(String(topic) == "penumats/"+id+"/switch/on"){
    StaticJsonDocument<256> docx;
    deserializeJson(docx, payload, length);
    Serial.println();
    int s = docx.getMember(String("switch"));
    int pin = pins[s];
    if(NULL!=pin){
       Serial.println("turning on switch");
       digitalWrite(pin, LOW);
       doc.getMember(String("switches"))[s]=true;
       char buffer[512];
       size_t n = serializeJson(doc, buffer);
       client.publish("penumats/update",buffer,n);
       
     }
  }
  
  if(String(topic) == "penumats/"+id+"/switch/off"){
    StaticJsonDocument<256> docx;
    deserializeJson(docx, payload, length);
    Serial.println();
    int s = docx.getMember(String("switch"));
    int pin = pins[s];
        
    if(NULL!=pin){
       Serial.println("turning off switch");
       digitalWrite(pin, HIGH);
       doc.getMember(String("switches"))[s]=false;
       char buffer[512];
        size_t n = serializeJson(doc, buffer);
        client.publish("penumats/update",buffer,n);
    }
  }

}

void reconnect() {
  
  // Loop until we're reconnected
  while (!client.connected()) {
    const char* sr = con["serverName"];
     Serial.println(id.c_str());

    Serial.print("Attempting MQTT connection...");
    if (client.connect(id.c_str())) {
      Serial.println("connected");
      client.subscribe("penumats/handshake/reinitiate");
      client.subscribe(("penumats/"+id+"/switch/on").c_str());
      client.subscribe(("penumats/"+id+"/switch/off").c_str());
      char buffer[512];
    size_t n = serializeJson(doc, buffer);
    client.publish("penumats/handshake/connect", buffer, n);
    client.publish("penumats/register", id.c_str());
    } else {
      Serial.println();
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      // Wait 5 seconds before retrying
      delay(5000);
    }
  }
}
