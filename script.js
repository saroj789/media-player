let player;
let isPlaying = false;
let isShuffle = false;
let repeatMode = 0; // 0 = off, 1 = playlist, 2 = single video
let currentPlaylist = [];
let progressInterval = null;

const videoMetadataCache = {};
const STORAGE_PLAYLIST_KEY = 'yt_saved_playlist_url';

function onYouTubeIframeAPIReady() {
  player = new YT.Player('yt-player', {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 0,
      controls: 0,
      rel: 0,
      fs: 0
    },
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });
}

function onPlayerReady(event) {
  setupEventListeners();
  autoLoadSavedPlaylist();
}

function autoLoadSavedPlaylist() {
  const savedUrl = localStorage.getItem(STORAGE_PLAYLIST_KEY);
  if (savedUrl) {
    const urlInput = document.getElementById('playlist-url-input');
    urlInput.value = savedUrl;

    const listId = extractPlaylistId(savedUrl);
    if (listId) {
      loadNewPlaylist(listId);
    }
  }
}

function loadNewPlaylist(listId) {
  if (player && typeof player.stopVideo === 'function') {
    player.stopVideo();
  }

  currentPlaylist = [];
  const container = document.getElementById('playlist-container');
  if (container) {
    container.innerHTML = `
      <div class="p-6 text-center text-neutral-500 text-sm mt-10 animate-pulse">
        Loading new playlist...
      </div>
    `;
  }

  player.loadPlaylist({ listType: 'playlist', list: listId, index: 0 });
}

function onPlayerStateChange(event) {
  const playIcon = document.getElementById('play-icon');

  if (event.data === YT.PlayerState.PLAYING) {
    isPlaying = true;
    playIcon.innerText = 'pause';
    startProgressTimer();
  } else {
    isPlaying = false;
    playIcon.innerText = 'play_arrow';
    if (event.data !== YT.PlayerState.BUFFERING) {
      stopProgressTimer();
    }
  }

  if (player && typeof player.getPlaylist === 'function') {
    const fetchedPlaylist = player.getPlaylist();
    if (fetchedPlaylist && fetchedPlaylist.length > 0) {
      if (JSON.stringify(fetchedPlaylist) !== JSON.stringify(currentPlaylist)) {
        currentPlaylist = fetchedPlaylist;
        renderPlaylistUI();
      }
    }
  }

  if (event.data === YT.PlayerState.PLAYING || event.data === YT.PlayerState.CUED) {
    updateCurrentVideoUI();
  }

  if (event.data === YT.PlayerState.ENDED) {
    if (repeatMode === 2) {
      player.seekTo(0);
      player.playVideo();
    }
  }
}

function setupEventListeners() {
  const loadBtn = document.getElementById('load-playlist-btn');
  const urlInput = document.getElementById('playlist-url-input');
  const playPauseBtn = document.getElementById('btn-play-pause');
  const nextBtn = document.getElementById('btn-next');
  const prevBtn = document.getElementById('btn-prev');
  const shuffleBtn = document.getElementById('btn-shuffle');
  const repeatBtn = document.getElementById('btn-repeat');
  const progressContainer = document.getElementById('progress-container');
  const volumeContainer = document.getElementById('volume-container');
  const volumeBtn = document.getElementById('btn-volume');
  const fullscreenBtn = document.getElementById('btn-fullscreen');
  const preferencesBtn = document.getElementById('btn-preferences');

  // Trigger load on button click
  loadBtn.addEventListener('click', () => {
    const rawUrl = urlInput.value.trim();
    const listId = extractPlaylistId(rawUrl);

    if (listId) {
      localStorage.setItem(STORAGE_PLAYLIST_KEY, rawUrl);
      loadNewPlaylist(listId);
    } else {
      alert('Please enter a valid YouTube Playlist URL (containing ?list=...)');
    }
  });

  // Trigger load when pressing ENTER in the input bar
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      loadBtn.click();
    }
  });

  playPauseBtn.addEventListener('click', () => {
    if (isPlaying) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  });

  nextBtn.addEventListener('click', () => player.nextVideo());
  prevBtn.addEventListener('click', () => player.previousVideo());

  shuffleBtn.addEventListener('click', () => {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle('is-active', isShuffle);
    player.setShuffle(isShuffle);
  });

  repeatBtn.addEventListener('click', () => {
    repeatMode = (repeatMode + 1) % 3;
    if (repeatMode === 0) {
      repeatBtn.classList.remove('is-active');
      repeatBtn.innerHTML = '<span class="material-symbols-outlined text-[18px] lg:text-[20px]">repeat</span>';
      player.setLoop(false);
    } else if (repeatMode === 1) {
      repeatBtn.classList.add('is-active');
      repeatBtn.innerHTML = '<span class="material-symbols-outlined text-[18px] lg:text-[20px]">repeat</span>';
      player.setLoop(true);
    } else {
      repeatBtn.classList.add('is-active');
      repeatBtn.innerHTML = '<span class="material-symbols-outlined text-[18px] lg:text-[20px]">repeat_one</span>';
      player.setLoop(true);
    }
  });

  progressContainer.addEventListener('click', (e) => {
    const rect = progressContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const duration = player.getDuration();
    if (duration) {
      player.seekTo(duration * percentage, true);
      updateProgressUI();
    }
  });

  volumeContainer.addEventListener('click', (e) => {
    const rect = volumeContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const volumePercent = Math.min(Math.max((clickX / rect.width) * 100, 0), 100);
    player.setVolume(volumePercent);
    document.getElementById('volume-fill').style.width = `${volumePercent}%`;

    const volumeIcon = document.getElementById('volume-icon');
    if (volumePercent === 0) volumeIcon.innerText = 'volume_off';
    else if (volumePercent < 50) volumeIcon.innerText = 'volume_down';
    else volumeIcon.innerText = 'volume_up';
  });

  volumeBtn.addEventListener('click', () => {
    if (player.isMuted()) {
      player.unMute();
      document.getElementById('volume-icon').innerText = 'volume_up';
      document.getElementById('volume-fill').style.width = '100%';
    } else {
      player.mute();
      document.getElementById('volume-icon').innerText = 'volume_off';
      document.getElementById('volume-fill').style.width = '0%';
    }
  });

  fullscreenBtn.addEventListener('click', () => {
    const wrapper = document.getElementById('player-wrapper');
    if (!document.fullscreenElement) {
      wrapper.requestFullscreen().catch(err => console.error(err));
    } else {
      document.exitFullscreen();
    }
  });

  if (preferencesBtn) {
    preferencesBtn.addEventListener('click', () => {
      console.log('Preferences clicked');
    });
  }
}

function startProgressTimer() {
  stopProgressTimer();
  progressInterval = setInterval(updateProgressUI, 500);
}

function stopProgressTimer() {
  if (progressInterval) clearInterval(progressInterval);
}

function updateProgressUI() {
  if (!player || !player.getCurrentTime) return;

  const current = player.getCurrentTime() || 0;
  const duration = player.getDuration() || 0;
  const percent = duration > 0 ? (current / duration) * 100 : 0;

  document.getElementById('time-current').innerText = formatTime(current);
  document.getElementById('time-total').innerText = formatTime(duration);

  const playedBar = document.getElementById('progress-played');
  const scrubber = document.getElementById('progress-scrubber');

  if (playedBar) playedBar.style.width = `${percent}%`;
  if (scrubber) scrubber.style.left = `${percent}%`;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function extractPlaylistId(url) {
  const regExp = /[?&]list=([^#\&\?]+)/;
  const match = url.match(regExp);
  return (match && match[1]) ? match[1] : null;
}

function renderPlaylistUI() {
  const container = document.getElementById('playlist-container');
  const countEl = document.getElementById('playlist-count');

  if (!currentPlaylist || currentPlaylist.length === 0) return;

  container.innerHTML = '';
  countEl.innerText = `${currentPlaylist.length} tracks`;

  currentPlaylist.forEach((videoId, index) => {
    const item = document.createElement('div');
    item.className = 'playlist-item flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-surface-container cursor-pointer transition-colors group';
    item.dataset.index = index;

    const thumbUrl = `https://img.youtube.com/vi/${videoId}/default.jpg`;
    const cached = videoMetadataCache[videoId];
    const displayTitle = cached ? cached.title : `Track ${index + 1}`;
    const displayAuthor = cached ? cached.author : `Video ID: ${videoId}`;

    item.innerHTML = `
      <div class="w-12 h-12 rounded bg-neutral-200 dark:bg-surface-container-high flex-shrink-0 bg-cover bg-center border border-neutral-200 dark:border-outline-variant/30" style="background-image: url('${thumbUrl}');"></div>
      <div class="flex-1 min-w-0">
        <p class="track-title text-sm text-neutral-700 dark:text-on-surface truncate group-hover:text-primary font-medium">${displayTitle}</p>
        <p class="track-artist text-xs text-neutral-500 truncate">${displayAuthor}</p>
      </div>
      <span class="material-symbols-outlined opacity-0 play-indicator text-primary text-[20px]">equalizer</span>
    `;

    item.addEventListener('click', () => player.playVideoAt(index));
    container.appendChild(item);
  });

  updateCurrentVideoUI();
}

function updateCurrentVideoUI() {
  const currentIndex = player.getPlaylistIndex();
  if (currentIndex === -1 || !currentPlaylist.length) return;

  const videoId = currentPlaylist[currentIndex];
  const thumbUrl = `https://img.youtube.com/vi/${videoId}/default.jpg`;

  const ytData = (player.getVideoData && player.getVideoData()) || {};
  const currentTitle = ytData.title || `Track ${currentIndex + 1}`;
  const currentAuthor = ytData.author || `Video ID: ${videoId}`;

  if (ytData.title) {
    videoMetadataCache[videoId] = { title: ytData.title, author: ytData.author };
  }

  document.getElementById('current-video-title').innerText = currentTitle;
  document.getElementById('current-video-index').innerText = currentAuthor;

  document.getElementById('mini-title').innerText = currentTitle;
  document.getElementById('mini-artist').innerText = currentAuthor;
  document.getElementById('mini-thumb').style.backgroundImage = `url('${thumbUrl}')`;

  const items = document.querySelectorAll('.playlist-item');
  items.forEach((item, index) => {
    const vId = currentPlaylist[index];
    const cached = videoMetadataCache[vId];
    const titleEl = item.querySelector('.track-title');
    const artistEl = item.querySelector('.track-artist');

    if (cached) {
      if (titleEl) titleEl.innerText = cached.title;
      if (artistEl) artistEl.innerText = cached.author;
    }

    const indicator = item.querySelector('.play-indicator');
    if (index === currentIndex) {
      item.classList.add('bg-neutral-100', 'dark:bg-surface-container-high');
      if (indicator) {
        indicator.classList.remove('opacity-0');
        indicator.classList.add('animate-pulse');
      }
    } else {
      item.classList.remove('bg-neutral-100', 'dark:bg-surface-container-high');
      if (indicator) {
        indicator.classList.add('opacity-0');
        indicator.classList.remove('animate-pulse');
      }
    }
  });
}