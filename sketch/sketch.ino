#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

const char* ssid = "Shashank";
const char* password = "meenakshi1234";
const char* mqtt_server = "test.mosquitto.org";

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
  
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  randomSeed(micros());

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
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

  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  
}
