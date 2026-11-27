import React, { useEffect, useRef, useState } from 'react'
import { Pause, Play, Repeat, Volume2, VolumeX } from 'lucide-react'
import type { ItemRendererProps, VideoItem } from '../types/board'

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export const VideoItemView: React.FC<ItemRendererProps<VideoItem>> = ({ item, onUpdate }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [aspectSynced, setAspectSynced] = useState(false)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.loop = item.loop
    v.muted = item.muted
    v.volume = item.volume
    v.playbackRate = item.playbackRate
  }, [item.loop, item.muted, item.volume, item.playbackRate])

  const togglePlay = (e: React.MouseEvent): void => {
    e.stopPropagation()
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      void v.play()
      setPlaying(true)
    } else {
      v.pause()
      setPlaying(false)
    }
  }

  const handleLoadedMetadata = (): void => {
    const v = videoRef.current
    if (!v) return
    setDuration(v.duration || 0)
    if (!aspectSynced && v.videoWidth > 0 && v.videoHeight > 0) {
      setAspectSynced(true)
      const ratio = v.videoWidth / v.videoHeight
      const baseW = Math.min(520, Math.max(260, item.width))
      onUpdate({
        width: baseW,
        height: Math.max(120, Math.round(baseW / ratio))
      })
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const v = videoRef.current
    if (!v) return
    const next = parseFloat(e.target.value)
    v.currentTime = next
    setCurrentTime(next)
  }

  const cycleRate = (e: React.MouseEvent): void => {
    e.stopPropagation()
    const rates = [0.5, 1, 1.5, 2]
    const idx = rates.indexOf(item.playbackRate)
    const nextRate = rates[(idx + 1) % rates.length]
    onUpdate({ playbackRate: nextRate })
  }

  return (
    <div className="item-video-container">
      <video
        ref={videoRef}
        src={item.src}
        preload="metadata"
        playsInline
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
        onEnded={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          background: '#0d0e11',
          display: 'block',
          pointerEvents: 'none'
        }}
      />

      <div className="item-badge">VIDEO · {item.name}</div>

      <div
        className="media-controls-bar"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="media-btn" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>

        <input
          type="range"
          className="media-scrubber"
          min={0}
          max={duration || 0}
          step={0.05}
          value={currentTime}
          onChange={handleSeek}
        />

        <span className="media-time">
          {formatTime(currentTime)}/{formatTime(duration)}
        </span>

        <button
          className={`media-btn ${item.loop ? 'active' : ''}`}
          onClick={() => onUpdate({ loop: !item.loop })}
          title="Toggle Loop"
        >
          <Repeat size={13} />
        </button>

        <button className="media-btn text-btn" onClick={cycleRate} title="Playback Speed">
          {item.playbackRate}x
        </button>

        <button
          className={`media-btn ${item.muted ? '' : 'active'}`}
          onClick={() => onUpdate({ muted: !item.muted })}
          title={item.muted ? 'Unmute' : 'Mute'}
        >
          {item.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
      </div>
    </div>
  )
}
