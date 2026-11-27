import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Music, Pause, Play, Repeat, Volume2, VolumeX } from 'lucide-react'
import type { ItemRendererProps, SoundItem } from '../types/board'

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export const SoundItemView: React.FC<ItemRendererProps<SoundItem>> = ({ item, onUpdate }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [liveBars, setLiveBars] = useState<number[] | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)

  // Deterministic decorative resting waveform seeded from item id
  const restingBars = useMemo(() => {
    let seed = 0
    for (let i = 0; i < item.id.length; i++) seed += item.id.charCodeAt(i) * (i + 1)
    return Array.from({ length: 28 }, (_, i) => {
      const v = Math.abs(Math.sin(seed * 0.13 + i * 0.65) * 0.65 + Math.cos(i * 1.1) * 0.25)
      return Math.min(0.92, Math.max(0.16, v))
    })
  }, [item.id])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    a.loop = item.loop
    a.volume = muted ? 0 : item.volume
  }, [item.loop, item.volume, muted])

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }

    const tick = (): void => {
      const analyser = analyserRef.current
      if (analyser) {
        const data = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)
        const nextBars: number[] = []
        const step = Math.max(1, Math.floor(data.length / 28))
        for (let i = 0; i < 28; i++) {
          const val = data[i * step] / 255
          nextBars.push(Math.max(0.14, val))
        }
        setLiveBars(nextBars)
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [playing])

  const bars = playing && liveBars ? liveBars : restingBars

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (ctxRef.current) {
        void ctxRef.current.close()
      }
    }
  }, [])

  const ensureAudioGraph = (): void => {
    const a = audioRef.current
    if (!a || analyserRef.current) return
    try {
      const AudioCtx = window.AudioContext
      const ctx = new AudioCtx()
      const source = ctx.createMediaElementSource(a)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 128
      source.connect(analyser)
      analyser.connect(ctx.destination)
      ctxRef.current = ctx
      analyserRef.current = analyser
    } catch {
      // Fallback: audio still plays cleanly even if WebAudio graph fails
    }
  }

  const togglePlay = (e: React.MouseEvent): void => {
    e.stopPropagation()
    const a = audioRef.current
    if (!a) return
    ensureAudioGraph()
    if (ctxRef.current?.state === 'suspended') {
      void ctxRef.current.resume()
    }
    if (a.paused) {
      void a.play()
      setPlaying(true)
    } else {
      a.pause()
      setPlaying(false)
    }
  }

  const progress = duration > 0 ? currentTime / duration : 0

  return (
    <div className="item-sound-container">
      <audio
        ref={audioRef}
        src={item.src}
        crossOrigin="anonymous"
        preload="metadata"
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onEnded={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      <div className="sound-header">
        <div className="sound-icon-pill">
          <Music size={14} />
        </div>
        <div className="sound-title" title={item.name}>
          {item.name}
        </div>
        <span className="sound-duration">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      <div className="sound-waveform">
        {bars.map((height, idx) => {
          const active = idx / bars.length <= progress
          return (
            <div
              key={idx}
              className={`sound-bar ${active ? 'played' : ''}`}
              style={{ height: `${Math.round(height * 100)}%` }}
            />
          )
        })}
      </div>

      <div
        className="sound-controls"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="media-btn primary"
          onClick={togglePlay}
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>

        <input
          type="range"
          className="media-scrubber"
          min={0}
          max={duration || 0}
          step={0.05}
          value={currentTime}
          onChange={(e) => {
            const val = parseFloat(e.target.value)
            if (audioRef.current) audioRef.current.currentTime = val
            setCurrentTime(val)
          }}
        />

        <button
          className={`media-btn ${item.loop ? 'active' : ''}`}
          onClick={() => onUpdate({ loop: !item.loop })}
          title="Loop"
        >
          <Repeat size={13} />
        </button>

        <button
          className={`media-btn ${muted ? '' : 'active'}`}
          onClick={() => setMuted((m) => !m)}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
        </button>
      </div>
    </div>
  )
}
