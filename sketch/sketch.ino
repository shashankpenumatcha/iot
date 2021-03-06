#include <ESP8266WiFi.h>
#include <ESP8266WiFiMulti.h>   // Include the Wi-Fi-Multi library
#include <ESP8266mDNS.h>        // Include the mDNS library
#include <ESP8266WebServer.h>   // Include the WebServer library

#include <PubSubClient.h>
#include <ArduinoJson.h>

const char* ssid = "Shashank";
const char* password = "meenakshi1234";
const char* mqtt_server = "raspberrypi.local";
ESP8266WiFiMulti wifiMulti;     // Create an instance of the ESP8266WiFiMulti class, called 'wifiMulti'

ESP8266WebServer server(80);    // Create a webserver object that listens for HTTP request on port 80

void handleRoot();              // function prototypes for HTTP handlers
void handleNotFound();

WiFiClient espClient;
PubSubClient client(espClient);

long lastMsg = 0;
char msg[50];
int value = 0;
String id = "nodemcu2";
int pins[] = {BUILTIN_LED};
StaticJsonDocument<200> doc;

void setup_wifi() {
  delay(10);
  
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);
  
  //WiFi.begin(ssid, password);
  wifiMulti.addAP(ssid, password);   // add Wi-Fi networks you want to connect to
    int i = 0;
  while (wifiMulti.run() != WL_CONNECTED) { // Wait for the Wi-Fi to connect: scan for Wi-Fi networks, and connect to the strongest of the networks above
    delay(1000);
    Serial.print(++i); Serial.print(' ');
  }
  Serial.println('\n');
  Serial.print("Connected to ");
  Serial.println(WiFi.SSID());              // Tell us what network we're connected to
  Serial.print("IP address:\t");
  Serial.println(WiFi.localIP());           // Send the IP address of the ESP8266 to the computer

  if (!MDNS.begin("esp8266")) {
    Serial.println("Error setting up MDNS responder!");
    while (1) {
      delay(1000);
    }
  }
  Serial.println("mDNS responder started");

    server.on("/", handleRoot);               // Call the 'handleRoot' function when a client requests URI "/"
    server.onNotFound(handleNotFound);        // When a client requests an unknown URI (i.e. something other than "/"), call function "handleNotFound"
  
    server.begin();                           // Actually start the server
    Serial.println("HTTP server started");
  MDNS.addService("http", "tcp", 80);


  //while (WiFi.status() != WL_CONNECTED) {
    //delay(500);
    //Serial.print(".");
  //}

 // randomSeed(micros());

  //Serial.println("");
  //Serial.println("WiFi connected");
  //Serial.println("IP address: ");
  //Serial.println(WiFi.localIP());
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
    Serial.print("Attempting MQTT connection...");
    if (client.connect(id.c_str())) {
      Serial.println("connected");
      client.subscribe("penumats/handshake/reinitiate");
      client.subscribe(("penumats/"+id+"/switch/on").c_str());
      client.subscribe(("penumats/"+id+"/switch/off").c_str());
      char buffer[512];
    size_t n = serializeJson(doc, buffer);
    client.publish("penumats/handshake/connect", buffer, n);
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      // Wait 5 seconds before retrying
      delay(5000);
    }
  }
}

void setup() {
  pinMode(BUILTIN_LED, OUTPUT);     // Initialize the BUILTIN_LED pin as an output
  Serial.begin(115200);
  doc["id"] = "nodemcu2";
  JsonArray switches = doc.createNestedArray("switches");
  switches.add(true);
  Serial.println();
  setup_wifi();
  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);
  
}

void loop() {
   MDNS.update();

  server.handleClient();

  if (!client.connected()) {
    reconnect();
  }
  client.loop();
}

void handleRoot() {
  server.send(200, "text/plain", "Hello world!");   // Send HTTP status 200 (Ok) and send some text to the browser/client
}

void handleNotFound(){
  server.send(404, "text/plain", "404: Not found"); // Send HTTP status 404 (Not Found) when there's no handler for the URI in the request
}
