function AudioNode(context, numberOfOutputs, numberOfInputs, sampleRate) {
  this.numberOfInputs = numberOfInputs;
  this.numberOfOutputs = numberOfOutputs;
  this.sampleRate = sampleRate;

  this.__context = context;
  this.__connectedTo = [];
  this.__connectedFrom = [];

  this.connect = function(destination, output, input) {
    this.__connectedTo[output || 0] = destination;
    
    destination.__connectedFrom[input || 0] = this;
  };

  this.disconnect = function(output) {
    var destination = this.__connectedTo[output || 0];
    this.__connectedTo[output || 0] = null;
    for(var i=0;i<destination.__connectedFrom.length;i++) {
      if(destination.__connectedFrom[i] === this) {
        destination.__connectedFrom[i] = null;
      }
    }
  };
}

function AudioBuffer(data, channels, sampleRate) {
  this.gain = { value: 1.0 };
  this.sampleRate = sampleRate;
  this.numberOfChannels = channels;

  this.__length = data.length;
  this.__data = data;

  this.duration = data.length / channels / sampleRate;

  this.getChannelData = function(channel) {
    var samples = new Float32Array(data.length /channels);

    for (var i=channel,j=0;i<data.length;i+=channels,j++) {
      samples[j] = data[i];
    }

    return samples;
  };
}

function AudioRequest(url, async) {
  // TODO async : if(!async) throw "Only async allowed";

  function loadAif(callback) {
    var req = new XMLHttpRequest();
    req.open('GET', url, true);
    req.overrideMimeType('text/plain; charset=x-user-defined');
    req.onreadystatechange = function (e) {
      if (req.readyState == 4) {
        if (req.status == 200 || req.status == 0) {
          var data = req.responseText;
          var channelCount = data.charCodeAt(21);
          var sampleCount = ((data.charCodeAt(22) && 0xFF) << 24) | ((data.charCodeAt(23) && 0xFF) << 16) | ((data.charCodeAt(24) && 0xFF) << 8) | (data.charCodeAt(25) && 0xFF);
          var offset = 54, len = sampleCount * channelCount;
          var samples = new Float32Array(len);
          for(var i=0; i < len; ++i) {
            var value = ((data.charCodeAt(offset) && 0xFF) << 8) | (data.charCodeAt(offset + 1) && 0xFF);
            if(value >= 0x8000) value |= ~0x7FFF;
            samples[i] = value / 0x8000;
            offset += 2;
          }
          callback(samples);
        } else {
          callback(null);
        }
      }
    };
    req.send(null);
  }

  this.onload = function() {};
  this.send = function() {
    var request = this;
    loadAif(function(data) {
      if (data) {
        request.buffer = new AudioBuffer(data, 2, 44100);
        request.onload();
      }
    });
  };
}

function AudioGainNode(context, template) {
  AudioNode.call(this, context, 1, 1, 44100);

  this.gain = { value: 1.0 };
}

function AudioSourceNode(context, numberOfOutputs, sampleRate) {
  AudioNode.call(this, context, numberOfOutputs, 0, sampleRate);

  this.playbackRate = { value: 1.0 };
}

function AudioBufferSourceNode(context) {
  AudioSourceNode.call(this, context, 1, 44100);

  this.buffer = null; // TODO setter to update sampleRate
  this.loop = false;

  this.noteOn = function(when) {};
  this.noteGrainOn = function(when, grainOffset, grainDuration) {};
  this.noteOff = function(when) {};
}

function ConvolverNode(context) {
  AudioNode.call(this, context, 1, 1, 44100);

  this.buffer = null;
}

function AudioLow2PassFilterNode(context, template) {
  AudioNode.call(this, context, 1, 1, 44100);

  this.cutoff = {};
  this.resonance = {};
}

function AudioMixerInputNode(context, mixer, index, template) {
  AudioNode.call(this, context, 1, 1, 44100);

  this.gain = { value: 1.0 };

  this.__index = index;
  this.__mixer = mixer;
}

function AudioMixerNode(context) {
  AudioNode.call(this, context, 1, 0);

  this.createInput = function(template) {
    var input = new AudioMixerInputNode(context, this, this.numberOfInputs, template);
    input.connect(this, this.numberOfInputs);
    ++this.numberOfInputs;
    return input;
  };
  this.outputGain = { value: 1.0 };
}

function AudioPannerNode(context, template) {
  AudioNode.call(this, context, 1, 1, 44100);

  this.panningModel = AudioPannerNode.HRTF;
  this.setPosition = function(x, y, z) {};
}
AudioPannerNode.HRTF = 2;

function AudioDestinationNode(context, tickCallback) {
  AudioNode.call(this, 0, 1, 44100);
  tickCallback(0);
}

function AudioContext() {
  var context = this;

  function tick(currentTime) {
    this.currentTime = currentTime;
  }

  this.destination = new AudioDestinationNode(this, tick);

  this.createConvolver = function() {
    return new ConvolverNode(this);
  };

  // undocumented
  this.createAudioRequest = function(url, async) {
    return new AudioRequest(url, async);
  };

  this.createBufferSource = function() {
    return new AudioBufferSourceNode(this);
  };

  this.createGainNode = function() {
    return new AudioGainNode(this);
  };

  this.createLowPass2Filter = function() {
    return new AudioLow2PassFilterNode(this);
  };
  
  // undocumented
  this.createMixer = function() {
    return new AudioMixerNode(this);
  };
  
  this.createPanner = function() {
    return new AudioPannerNode(this);
  };
}

/*
function AudioElementSourceNode(audioElement) {
  this.audioAvailable = function(event) {
    // dispatch audio down the chain
    var frameBuffer = event.mozFrameBuffer;
    for (var i in outputs) {
      this.outputs[i].send(frameBuffer);
    }
  };

  audioElement.eventListener('audiowritten', this.audioAvailable, false);
}
AudioElementSourceNode.prototype = new AudioNode(); // AudioElementSourceNode inherits from AudioNode
*/
