/** vanspeak
 *  a plugin to speak your words
 *  v 1.0.2
 * the first version some params was not supported beacuse we force users to accept US accent and the speed
 **/
(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.vanSpeak = root.vanspeak = root.Vanspeak = factory();
  }
}(this, function () {
  var mix = function (des, src, override) {
    if (typeof override == 'function') {
      for (var i in src) {
        des[i] = override(des[i], src[i], i);
      }
    } else {
      for (i in src) {
        if (override || !(des[i] || (i in des))) {
          des[i] = src[i];
        }
      }
    }

    return des;
  };

  // simple xhr
  var xhr = function (method, url, headers, data, callback) {

    var r = new XMLHttpRequest();
    var error = this.error;

    // Binary?
    var binary = false;
    if (method === 'blob') {
      binary = method;
      method = 'GET';
    }

    method = method.toUpperCase();

    // Xhr.responseType 'json' is not supported in any of the vendors yet.
    r.onload = function (e) {
      var json = r.response;
      try {
        json = JSON.parse(r.responseText);
      } catch (_e) {
        if (r.status === 401) {
          json = console.error('access_denied', r.statusText);
        }
      }

      var headers = headersToJSON(r.getAllResponseHeaders());
      headers.statusCode = r.status;
      callback = callback || function () {};
      callback(json || (method === 'GET' ? error('empty_response', 'Could not get resource') : {}), headers);
    };

    r.onerror = function (e) {
      var json = r.responseText;
      try {
        json = JSON.parse(r.responseText);
      } catch (_e) {}

      callback && callback(json || console.error('access_denied', 'Could not get resource'));
    };

    var x;

    // Should we add the query to the URL?
    if (method === 'GET' || method === 'DELETE') {
      data = null;
    } else if (data && typeof (data) !== 'string' && !(data instanceof FormData) && !(data instanceof File) && !(data instanceof Blob)) {
      // Loop through and add formData
      var f = new FormData();
      for (x in data)
        if (data.hasOwnProperty(x)) {
          if (data[x] instanceof HTMLInputElement) {
            if ('files' in data[x] && data[x].files.length > 0) {
              f.append(x, data[x].files[0]);
            }
          } else if (data[x] instanceof Blob) {
            f.append(x, data[x], data.name);
          } else {
            f.append(x, data[x]);
          }
        }

      data = f;
    }

    // Open the path, async
    r.open(method, url, true);

    if (binary) {
      if ('responseType' in r) {
        r.responseType = binary;
      } else {
        r.overrideMimeType('text/plain; charset=x-user-defined');
      }
    }

    // Set any bespoke headers
    if (headers) {
      for (x in headers) {
        r.setRequestHeader(x, headers[x]);
      }
    }

    r.send(data);

    return r;

    // Headers are returned as a string
    function headersToJSON(s) {
      var r = {};
      var reg = /([a-z\-]+):\s?(.*);?/gi;
      var m;
      while ((m = reg.exec(s))) {
        r[m[1]] = m[2];
      }
      return r;
    }
  };

  var ua = window.navigator.userAgent.toLowerCase();
  var UA = {
    isAndroid: function () {
      return ua.indexOf('android') > -1;
    },
    isIOS: function () {
      return /(iPad|iPhone|iPod)/gi.test(ua);
    },
    isIOS9: function () {
      return /(iphone|ipod|ipad).* os 9_/.test(ua);
    },
    isChrome: function () {
      return ua.indexOf('chrome') > -1;
    },
    isSafari: function () {
      return ua.indexOf('safari') > -1 && !(ua.indexOf('chrome') > -1);
    },
    isUCBrowser: function () {
      return ua.indexOf('ucbrowser') > -1;
    }

  };

  // Text analyse
  var SpeechText = {
    // check the word is the normal word we are not supporting sentences Cache
    isWord: function (word, maxWordNum) {
      var maxWordNum = maxWordNum || 120;
      var max = maxWordNum / 2;
      if (word.length > max) {
        return false;
      }
      if (/^[a-zA-Z\d\.\s_\-\']+$/.test(word)) {
        return true;
      }
      return false;
    },

    /** if your sentence is so long we need divid those words into groups 
     * EG : 'hello this.... end' => ['hello ...','...','end']
     **/
    groupWords: function (words, maxWordNum) {
      var max = maxWordNum || 100;
      var wordsGroup = [];
      if (words.length > max) {
        var tmptxt = words;

        while (tmptxt.length > max) {
          //Split by common phrase delimiters
          var p = tmptxt.search(/[:!?.;。！；]+/);
          var part = '';
          //Coludn't split by priority characters, try commas
          if (p == -1 || p >= max) {
            p = tmptxt.search(/[,]+/);
          }

          //Check for spaces. If no spaces then split by 99 characters.
          if (p == -1) {

            if (tmptxt.search(' ') == -1)
              p = 99;
          }

          //Couldn't split by normal characters, then we use spaces
          if (p == -1 || p >= max) {
            var words = tmptxt.split(' ');
            for (var i = 0; i < words.length; i++) {
              if (part.length + words[i].length + 1 > max)
                break;
              part += (i != 0 ? ' ' : '') + words[i];

            }

          } else {
            part = tmptxt.substr(0, p + 1);
          }

          tmptxt = tmptxt.substr(part.length, tmptxt.length - part.length);
          wordsGroup.push(part);
        }
        //Add the remaining text
        if (tmptxt.length > 0) {
          wordsGroup.push(tmptxt);
        }
        return [wordsGroup.join(' ')];
      } else {
        return [words];
      }

    },

    getSpeechTime: function (speed, words) {
      // this is a normal speed 
      var WORDS_PER_MINUTE = 130;
      var multiplier = speed;
      if (voice.timerSpeed === null) {
        multiplier = 1;
      }
      if (multiplier <= 0) {
        return;
      }
      var realwords = words.split(/\s+/).length;
      var chars = (words.match(/[^ ]/igm) || words).length;
      //word length factor: 5.1 is the average word length in english.
      var wlf = (chars / realwords) / 5.1;
      //avg 140 words per minute speech time
      var length = multiplier * 1000 * (60 / WORDS_PER_MINUTE) * wlf * realwords;
      if (words < 3) {
        length = 4000;
      }
      if (length < 3000) {
        length = 3000;
      }
      return length;

    },


  };

  // TTS class
  function TTS(voices, options) {
    // we only provide english 
    this.defaultOptions = {
      'rate': 0.7,
      'volume': 1,
      // max words num for better experence  so we limit max words 
      'maxWordNum': 100,
      'speechStart': function () {},
      'speechEnd': function () {},
      'speechError': function () {
        console.warn('Voice not working!');
      }
    };

    this.iosVoiceInit === false;
    this.utterances = [];

  }


  TTS.prototype = {

    setVoices: function (voices) {
      var VOICES = {
        'us': [
          {
            name: 'Google US English',
            default: false,
            voiceURI: "Google US English",
            lang: "en-US",
            localService: false
            },
          {
            name: 'English United States',
            lang: 'en_US'
            },
          {
            name: 'en-US',
            rate: 0.2,
            pitch: 1,
            timerSpeed: 1.3
            },
          {
            name: 'Samantha',
            voiceURI: 'com.apple.speech.synthesis.voice.Samantha'
            }
        ],
      };
      var iosCacheVoice = {
        "name": "en-US",
        "voiceURI": "en-US",
        "lang": "en-US"
      };
      var ios9CacheVoice = {
        name: "Samantha",
        voiceURI: "com.apple.ttsbundle.Samantha-premium",
        lang: "en-US",
        localService: !0,
        "default": !0
      };
      var speakVoice = null;
      if (UA.isChrome()) {
        speakVoice = VOICES['us'][0];
      }
      if (UA.isSafari()) {
        speakVoice = VOICES['us'][3];
      }
      if (UA.isAndroid()) {
        speakVoice = VOICES['us'][1]
      }
      if (UA.isIOS()) {
        speakVoice = iosCacheVoice;
      }

      if (UA.isIOS9()) {
        speakVoice = ios9CacheVoice;
        this.voice = speakVoice;
        return;
      }

      function getSystemVoice(name, voices, lang) {
        for (var i = 0; i < voices.length; i++) {
          if (voices[i].name == name) {
            return voices[i];
          }

          // for some device we should  find the right language
        }
        for (var i = 0; i < voices.length; i++) {
          if (voices[i].lang == lang) {
            return voices[i];
          }
        }
        return this.voice = false;
      }

      this.voice = getSystemVoice(speakVoice['name'], voices, speakVoice['lang']);
    },

    say: function (words, options) {
      this.options = mix(this.defaultOptions, options);
      if (this.isPlaying()) {
        this.cancel();
      }
      if (UA.isIOS9() && this.iosVoiceInit === false) {
        setTimeout(function () {
          self.say(words, params);
        }, 100);
        self.startHandle();
      }
      if (!this.voice) {
        return ats.say(words);
      }
      var self = this;
      var speechAllTest = false;
      this.wordsGroup = SpeechText.groupWords(words);
      for (var i = 0; i < this.wordsGroup.length; i++) {
        // use speech api SpeechSynthesis
        var word = self.wordsGroup[i];
        var msg = new SpeechSynthesisUtterance();

        if (this.voice.voiceURI) {
          msg.voice = this.voice;
          msg.voiceURI = this.voice.voiceURI;
        }
        // we need loudly volume
        msg.volume = 1;
        if (UA.isIOS()) {
          msg.rate = (this.options.rate != null ? (this.options.rate * this.options.rate) : 1) * msg.rate;
        } else {
          msg.rate = (this.options.rate != null ? this.options.rate : 1) * msg.rate;
        }
        msg.pitch = self.selectBest([this.options.pitch, 1]);
        msg.text = this.wordsGroup[i];
        msg.lang = this.voice.lang;
        msg.rvIndex = i;
        msg.rvTotal = this.wordsGroup.length;
        if (i == 0) {
          msg.onstart = self.options.speechStart;
        }
        this.options.onendcalled = false;
        this.options.words = msg.text;
        if (i < this.wordsGroup.length - 1 && this.wordsGroup.length > 1) {
          msg.onend = this.onPartEnd.bind(this);
          if (msg.hasOwnProperty("addEventListener"))
            msg.addEventListener('end', function () {
              self.onPartEnd()
            });

        } else {
          msg.onend = this.options.speechEnd;
          if (msg.hasOwnProperty("addEventListener")) {
            msg.addEventListener('end', this.options.speechEnd);
          }
          //  msg.onerror = this.options.speechError;
          // TODO 
          //  msg.onpause = this.options.onpause;
          //  msg.onresume = this.options.onresume;
          //  msg.onmark = this.options.onmark;
          msg.onboundary = this.options.onboundary || self.onboundary.bind(self);
          // msg.pitch = this.options.pitch || msg.pitch;
          msg.volume = this.options.volume || msg.volume;

        }

        this.utterances.push(msg);
        if (i == 0) {
          this.currentMsg = msg;
        }
        speechAllTest = true;
        this.runTTS(msg);
      }

      return speechAllTest;

    },

    runTTS: function (msg) {
      var self = this;
      setTimeout(function () {
        self.cancelled = false;
        speechSynthesis.speak(msg);
      }, 0.01);
    },

    // 取消发音
    cancel: function () {
      this.checkAndCancelTimeout();
      this.cancelled = true;
      speechSynthesis.cancel();
      return this.cancelled;
    },

    // iOS <= 9.x iOS devices not support autospeak we need force user to touch the screen to enactive the speech
    startHandle: function () {
      if (UA.isIOS() && !this.iosVoiceInit) {
        var u = new SpeechSynthesisUtterance(" ");
        speechSynthesis.speak(u);
        this.iosVoiceInit = true;
      }
    },

    setVolume: function (volume) {
      var v = this.options.volume = volume <= 1 ? volume : 1;
      for (var i = 0; i < this.utterances.length; i++) {
        this.utterances[i].volume = v;
      }
    },

    preAudio: function () {},

    isPlaying: function () {
      return speechSynthesis && speechSynthesis.speaking;
    },

    speechEnd: function () {
      this.options.speechEnd();
    },

    startTimeout: function (words, callback) {
      var time = SpeechText.getSpeechTime(this.voice.speed, words);
      this.timeoutId = setTimeout(callback, time);

    },

    selectBest: function (a) {
      for (var i = 0; i < a.length; i++) {
        if (a[i] != null) return a[i];
      }
      return null;
    },

    startTTS: function () {
      var self = this;
      if (this.onstartFired) {
        return
      }

      this.onstartFired = true;
      if (UA.isIOS() || UA.isSafari() || UA.isAndroid()) {
        if (speakMode === 1)
          self.startTimeout(self.params.words, self.speech_timedout);

      }
      self.params.onendcalled = false;
      if (self.params != null && self.params.onstart != null) {
        self.params.onstart();
      }

    },

    endTTS: function () {
      this.checkAndCancelTimeout();

      if (this.cancelled === true) {
        this.cancelled = false;
        return;
      }

      if (this.params != null && this.params.onend != null && this.params.onendcalled != true) {
        this.params.onendcalled = true;
        this.params.onend();

      }

    },

    onboundary: function (e) {
      var self = this;
      if (UA.isIOS() && !self.onstartFired) {
        self.startTTS();
      }
    },


    onPartEnd: function (e) {

      if (this.params != null && this.params.onchuckend != null) {
        this.params.onchuckend();
      }

      this.dispatch("OnPartEnd");

      var i = this.utterances.indexOf(e.utterance);
      this.currentMsg = this.utterances[i + 1];

    },

    dispatch: function (name) {
      var self = this;
      if (self.hasOwnProperty(name + "_callbacks") &&
        self[name + "_callbacks"] != null &&
        self[name + "_callbacks"].length > 0) {
        var callbacks = self[name + "_callbacks"];
        for (var i = 0; i < callbacks.length; i++) {
          callbacks[i]();
        }
        return true;
      } else {
        //Try calling a few ms later
        var timeoutName = name + "_callbacks_timeout";
        var timeoutCount = name + "_callbacks_timeoutCount";
        if (self.hasOwnProperty(timeoutName)) {

        } else {
          self[timeoutCount] = 10;
          self[timeoutName] = setInterval(function () {
            self[timeoutCount] = self[timeoutCount] - 1;

            if (self.dispatch(name) || self[timeoutCount] < 0) {
              clearTimeout(self[timeoutName]);
            }
          }, 50);
        }

        return false;
      }
    },


    checkAndCancelTimeout: function () {
      if (this.timeoutId != null) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }
    },


  };


  // 使用音频的发音  
  function AudioTTS() {
      this.apis = {
        "single": "http://api.vanthink.cn/api/audio/index?t=",
        "multi": "http://api.vanthink.cn/api/audio/multi?t=",
        "sentence": "http://v.vanthink.cn/?tl=en-US&sv=&vn=&pitch=0.5&vol=1&t=",
      };
      this.audioList = [];
      // the audio has finished list
      this.audioPlayedList = [];
      // preload audio list
      this.preloadAudioList = [];
      this.defaultOptions = {
        'rate': 0.7,
        'volume': 1,
        // max words num for better experence  so we limit max words 
        'maxWordNum': 100,
        'speechStart': function () {},
        'speechEnd': function () {},
        'speechError': function () {
          console.warn('Voice not workong!');
        }
      };

      this.audio = new Audio();
      this.audio.style.width = 0;
      this.audio.preload = 'auto';
      this.audio.style.position = 'absolute';
      this.audio.style.left = '-5000px';
      this.audio.loop = false;
      this.audio.setAttribute('id', 'tts');
      var self = this;
      try {
        this.audio.addEventListener('timeupdate', function (e) {
          if (this.currentTime == this.duration) {
            if (!UA.isUCBrowser()) {
             // this.currentTime = 0;
            }
            self.audio.pause();
            self.audioPlayFinish(e);
          } else if (!self.isPlaying() && UA.isUCBrowser()) {
            
            self.audio.play();
          }
        });
      } catch (ew) {
        this.audio.onended = function (e) {
          self.audioPlayFinish(e);
        };
      }

      document.body.appendChild(this.audio);
    }
    // keep the same api whidth TTS  
  AudioTTS.prototype = {
    say: function (words, options) {
      this.options = mix(this.defaultOptions, options);
      if (this.isPlaying()) {
        this.cancel();
      }
      if (this.audioList.length > 0) {
        this.clearAudio();
      }
      // words detect and group
      this.wordsGroup = SpeechText.groupWords(words);
      for (var i = 0; i < this.wordsGroup.length; i++) {
        // use speech api SpeechSynthesis
        var word = this.wordsGroup[i];
        // the audio url
        var src = '';
        var cacheAudio = this.findPreLoadAudio(word);
        if (cacheAudio !== false) {
          src = cacheAudio['src'];
          this.audioList.push({
            key: word,
            src: src,
          });
          if (!this.isPlaying() && this.audioList.length == 1) {
            this.audioTrackIndex = 0;
            this.playAudio();
          }
        } else {
          // if user say a long sentences we suggest to use sentences api
          var rate = this.options.rate / 2;
          rate = Math.min(Math.max(rate, 0), 1);
          if (!SpeechText.isWord(word)) {

            var url = this.apis['sentence'] + '&rate=' + rate + '&t=' + encodeURIComponent(word);
            this.createAudio(word, url);
          } else {
            var self = this;
            var url = this.apis['sentence'] + '&rate=' + rate + '&t=' + encodeURIComponent(word);
            this.playAudio(url, true);
            this.getAudio('single', word, function (res) {
              if (res.errcode == 0) {
                src = res.data;
                self.addPreLoadAudio(word, src);
              }
            });

          }
        }
      }

    },

    setVolume: function (volume) {
      var v = this.options.volume = volume <= 1 ? volume : 1;
      for (var i = 0; i < this.audioList.length; i++) {
        this.audioList[i].volume = v;
      }
      for (var i = 0; i < self.audioPlayedList.length; i++) {
        self.audioPlayedList[i].volume = v;
      }
      this.currentAudio.volume = v;

    },

    cancel: function () {
      var audio = document.querySelector('#tts');
      if (audio != null) {
        audio.pause();
      }
      this.clearAudio();

    },

    startHandle: function () {
      console.log('audio inited');
    },

    preAudio: function (arr) {

      if (!Array.isArray(arr)) {
        return;
      }
      var newWordArr = [];
      for (var i = 0; i < arr.length; i++) {
        if (SpeechText.isWord(arr[i]) && this.preloadAudioList.indexOf(arr[i]) == -1) {
          newWordArr.push(arr[i]);
        }
      }
      var self = this;
      this.getAudio('multi', JSON.stringify(newWordArr), function (res) {
        if (res.errcode == 0) {
          for (var i = 0; i < res.data.length; i++) {
            xhr('GET', res.data[i]);
            self.addPreLoadAudio(newWordArr[i], res.data[i]);
          }
        }
      });


    },

    isPlaying: function () {
      return (this.currentAudio != null && !this.currentAudio.ended && !this.currentAudio.paused);
    },


    // find the cache voice
    findPreLoadAudio: function (name) {
      for (var i = 0; i < this.preloadAudioList.length; i++) {
        if (this.preloadAudioList[i]['key'] === name) {
          return this.preloadAudioList[i];
        }
      }
      return false;
    },

    addPreLoadAudio: function (word, src, noPreload) {
      var hasThisKey = this.findPreLoadAudio(word);
      if (!hasThisKey && !noPreload) {
        this.loadAudio(src);
      }
      this.preloadAudioList.push({
        key: word,
        src: src
      });
    },

    createAudio: function (word, src) {
      this.audioList.push({
        key: word,
        src: src,
      });
      this.addPreLoadAudio(word, src, true);
      if (!this.isPlaying() && this.audioList.length == 1) {
        this.audioTrackIndex = 0;
        this.playAudio();
      }
    },

    loadAudio: function (src) {
      var iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.width = 0;
      iframe.style.left = '-5000px';
      iframe.src = src;
      iframe.onload = function () {};
    },

    playAudio: function (src) {
      var self = this;
      var audio = document.querySelector('#tts');
      if (!src) {
        if (this.audioTrackIndex == this.audioList.length) {
          audio.src = '';
          audio.pause();
          return;
        }
        audio.src = this.audioList[this.audioTrackIndex]['src'];
        this.audioPlayedList.push(this.audioList[this.audioTrackIndex]);
      } else {
        audio.src = src
      }

      setTimeout(function () {
        audio.playbackRate = 1;
      }, 50)
      audio.onloadedmetadata = function () {
        audio.play();
      }



      audio.play();
      audio.currentTime = 0;
    },

    audioPlayFinish: function (e) {
      if (this.audioTrackIndex <= this.audioList.length - 1) {
        this.audioTrackIndex++;
        this.playAudio();
      }
    },

    clearAudio: function () {
      return this.audioList = [];
    },

    getAudio: function (type, q, callback, isCache) {
      var url = this.apis[type] + encodeURIComponent(q) + '&_req=' + (isCache ? '' : (new Date()).getTime() + '.' + Math.floor(Math.random() * 10000));
      xhr('GET', url, {}, {}, callback);

    },


  };

  var vanspeak = null,
    ats = new AudioTTS();

  if (typeof (window.speechSynthesis) != 'undefined') {
    var voiceFindTry = 0;
    var voices = window.speechSynthesis.getVoices();
    vanspeak = new TTS(voices);
    setTimeout(function () {
      var gsvinterval = setInterval(function () {
        // get all voice supported
        voices = window.speechSynthesis.getVoices();
        if (voices.length == 0) {
          voiceFindTry++;
          if (voiceFindTry > 20) {
            clearInterval(gsvinterval);
            //On IOS, sometimes getVoices is just empty, but speech works. So we use a cached voice collection.
            if (window.speechSynthesis != null) {
              if (UA.isIOS()) {
                vanspeak.setVoices(voices);
              }
            }
          }
        } else {
          clearInterval(gsvinterval);
          vanspeak.setVoices(voices);
          if (!vanspeak.voice) {
            vanspeak = ats;
          }
        }

      }, 25);
    }, 100);
  } else {
    vanspeak = ats;
  }

  // prevent audio not stop   
  window.onbeforeunload = function () {
    try {
      vanspeak.cancel();
    } catch (ew) {
      console.log('page closed');
    }
  }

  return vanspeak;
}));