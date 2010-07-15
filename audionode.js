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
  this.__routePull = function(data, time) {
  };
}

function AudioBuffer(data, channels, sampleRate) {
  this.gain = { value: 1.0 };
  this.sampleRate = sampleRate;
  this.numberOfChannels = channels;

  this.__numberOfSamples = data.length /channels; 
  this.__length = data.length;
  this.__data = data;

  this.duration = data.length / channels / sampleRate;

  this.getChannelData = function(channel) {
    var samples = new Float32Array(data.length /channels);

    for(var i=channel,j=0;i<data.length;i+=channels,j++) {
      samples[j] = data[i];
    }

    return samples;
  };
  this.__copyData = function(channel, sourceOffset, target, offset, count) {
    var i = channel + sourceOffset * channels;

    for(var j=0;j<count;j++) {
      target[j + offset] = data[i];
      i+=channels;
    }
  };
}

function AudioRequest(url, async) {
  // TODO async

  function loadAif(callback) {
    var req = new XMLHttpRequest();   
    req.open('GET', url, true);
    req.overrideMimeType('text/plain; charset=x-user-defined');   
    req.onreadystatechange = function (e) {   
      if (req.readyState == 4) {   
        if(req.status == 200 || req.status == 0) {
          var data = req.responseText;
          var channelCount = data.charCodeAt(21);
          var sampleCount = ((data.charCodeAt(22) & 0xFF) << 24) |
          ((data.charCodeAt(23) & 0xFF) << 16) | ((data.charCodeAt(24) & 0xFF) << 8) | (data.charCodeAt(25) & 0xFF);
          var offset = 54, len = sampleCount * channelCount;
          var samples = new Float32Array(len);
          for(var i=0; i < len; ++i) {
            var value = ((data.charCodeAt(offset) & 0xFF) << 8) | (data.charCodeAt(offset + 1) & 0xFF);
            if(value >= 0x8000) value |= ~0x7FFF;
            samples[i] = value / 0x8000;
            offset += 2;
          }
          callback(samples);
        } else  
          callback(null);
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
  
  this.__routePull = function(data, time) {
    this.__connectedFrom[0].__routePull(data, time);
    
    var gain = this.gain.value;
    for(var i=0;i<data.length;++i) data[i] *= gain;
  };
}

// undocumented
function AudioSourceNode(context, numberOfOutputs, sampleRate) {
  AudioNode.call(this, context, numberOfOutputs, 0, sampleRate);

  this.playbackRate = { value: 1.0 };
  
  this.__pullData = function(data, time) {
  };
  
  var tail = 0;
  this.__routePull = function(data, time) {
    var playbackRate = this.playbackRate.value;
    var samplesToPullEst = data.length * playbackRate + tail;
    var samplesToPull = Math.floor(samplesToPullEst);
    tail = samplesToPullEst - samplesToPull;
    
    var sourceData = new Float32Array(samplesToPull);
    this.__pullData(sourceData, time);
    for(var i=0,j=0;i<data.length;i++,j+=playbackRate) {
      data[i] += sourceData[0|j];
    }
  };  
}

function AudioBufferSourceNode(context) {
  AudioSourceNode.call(this, context, 1, 44100);

  this.buffer = null; // TODO setter to update sampleRate
  this.loop = false;
  
  var isOn = false, currentOffset;
  var onWhen = null, offWhen = null;

  this.noteOn = function(when) { onWhen = when||0; };
  this.noteGrainOn = function(when, grainOffset, grainDuration) { throw "not implemented"; };
  this.noteOff = function(when) { offWhen = when||0; };
  
  this.__pullData = function(data, time) {
    if(onWhen !== null) {
      if(onWhen <= time) { 
        if(!isOn) { 
          isOn = true;
          currentOffset = 0;
        }
        onWhen = null; 
      }
    }
    if(offWhen !== null) {
      if(offWhen <= time) { 
        isOn = false; 
        offWhen = null; 
      }
    }
    var buffer = this.buffer;
    if(isOn && buffer) {
      var tail = buffer.__numberOfSamples - currentOffset;
      var offset = 0, count = data.length;
      while(tail < count) {
        buffer.__copyData(0, currentOffset, data, offset, tail);
        offset += tail; count -= tail;
        if(this.loop) {
          correntOffset = 0;
          tail = buffer.__numberOfSamples;
        } else {
          isOn = false; 
          break;
        }
      }
      if(isOn && count > 0) {
        buffer.__copyData(0, currentOffset, data, offset, count);
        currentOffset += count;
        
        if(currentOffset >= buffer.__numberOfSamples) {
          if(this.loop) {
            currentOffset = 0;
          } else {
            isOn = false;
          }
        }
      }
    }
  };
}

function ConvolverNode(context) {
  AudioNode.call(this, context, 1, 1, 44100);

  this.buffer = null;

  this.__routePull = function(data, time) {
    this.__connectedFrom[0].__routePull(data, time);
  };
}

function AudioLow2PassFilterNode(context, template) {
  AudioNode.call(this, context, 1, 1, 44100);

  this.cutoff = {};
  this.resonance = {};

  this.__routePull = function(data, time) {
    this.__connectedFrom[0].__routePull(data, time);
  };
}

function AudioMixerInputNode(context, mixer, index, template) {
  AudioNode.call(this, context, 1, 1, 44100);

  this.gain = { value: 1.0 };

  this.__index = index;
  this.__mixer = mixer;

  this.__routePull = function(data, time) {
    this.__connectedFrom[0].__routePull(data, time);
  };
}

function AudioMixerNode(context) {
  AudioNode.call(this, context, 1, 0);

  this.createInput = function(template) {
    var input = new AudioMixerInputNode(context, this, this.numberOfInputs, template);
    input.connect(this, 0, this.numberOfInputs);
    ++this.numberOfInputs;
    return input;
  };
  this.outputGain = { value: 1.0 };

  this.__routePull = function(data, time) {
    for(var i=0;i<this.numberOfInputs;i++) {
      var inputData = new Float32Array(data.length);
      this.__connectedFrom[i].__routePull(inputData, time);
      
      for(var j=0;j<data.length;++j) {
        data[j] += inputData[j];
      }
    }
  };
}

function AudioPannerNode(context, template) {
  AudioNode.call(this, context, 1, 1, 44100);

  this.panningModel = AudioPannerNode.HRTF;
  this.setPosition = function(x, y, z) {};

  this.__routePull = function(data, time) {
    this.__connectedFrom[0].__routePull(data, time);
  };
}
AudioPannerNode.HRTF = 2;

function AudioDestinationNode(context, tickCallback) {
  var destination = this;
  
  var SAMPLE_RATE = 44100;
  var CHANNELS = 1;
  var PREBUFFER_SIZE = 20000;
  var PORTION_SIZE = 1024;
  AudioNode.call(this, context, 0, 1, 44100);
  
  var audio = new Audio();
  audio.mozSetup(CHANNELS, SAMPLE_RATE, 1);
  var readOffset = 0;
  var writeOffset = 0;
  
  this.__audio = audio;

  this.__routePull = function(data, time) {
    this.__connectedFrom[0].__routePull(data, time);
  };
  
  function pullData(chunkSize, time) {
    var data = new Float32Array(chunkSize);
    destination.__routePull(data,time);
    return data;
  }
  
  function tick() {
    var currentOffset = audio.mozCurrentSampleOffset();
    if(readOffset < currentOffset) {
      var time = currentOffset / SAMPLE_RATE / CHANNELS;
      tickCallback(time);
    }
    if(currentOffset + PREBUFFER_SIZE >= writeOffset) {
      var data = pullData(PORTION_SIZE, writeOffset / SAMPLE_RATE / CHANNELS);
      audio.mozWriteAudio(data);
      writeOffset += PORTION_SIZE;
    }
    readOffset = currentOffset;
  }
  
  var interval = setInterval(tick, 10);
  
  tickCallback(0);
}

function AudioContext() {
  var context = this;

  function tick(currentTime) {
    context.currentTime = currentTime;
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
