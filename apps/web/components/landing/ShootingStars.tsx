import React from 'react';
import styles from './ShootingStars.module.css';

/**
 * Ambient night sky for the hero. Purely decorative, so it is hidden from
 * assistive tech, ignores pointer input, and is contained so it can never
 * affect layout or scroll.
 *
 * Positions and timings are fixed rather than random: the markup must render
 * identically on the server and the client, and a random value generated during
 * render would be a hydration mismatch. The visual variety comes from varied
 * constants, and the animation itself never repeats in lockstep because each
 * meteor has its own duration and negative delay.
 */
const STARS = [
  { top: '14%', left: '8%', size: 2, delay: '-1.2s', duration: '5.5s', max: 0.7 },
  { top: '62%', left: '17%', size: 1.5, delay: '-3.4s', duration: '7s', max: 0.5 },
  { top: '28%', left: '29%', size: 2.5, delay: '-0.6s', duration: '6.5s', max: 0.8 },
  { top: '78%', left: '34%', size: 1.5, delay: '-4.8s', duration: '8s', max: 0.45 },
  { top: '46%', left: '43%', size: 2, delay: '-2.1s', duration: '6s', max: 0.65 },
  { top: '12%', left: '58%', size: 1.5, delay: '-5.4s', duration: '7.5s', max: 0.5 },
  { top: '70%', left: '63%', size: 2.5, delay: '-3.9s', duration: '6.2s', max: 0.75 },
  { top: '35%', left: '74%', size: 1.5, delay: '-1.9s', duration: '8.5s', max: 0.45 },
  { top: '84%', left: '81%', size: 2, delay: '-4.4s', duration: '6.8s', max: 0.6 },
  { top: '22%', left: '88%', size: 1.5, delay: '-2.7s', duration: '7.2s', max: 0.5 },
  { top: '56%', left: '93%', size: 2, delay: '-0.9s', duration: '9s', max: 0.55 },
  { top: '90%', left: '52%', size: 1.5, delay: '-6.2s', duration: '7.8s', max: 0.4 },
] as const;

const METEORS = [
  { top: '16%', left: '6%', length: 130, delay: '-3s', duration: '1.7s', travel: 340, travelY: 140 },
  { top: '34%', left: '52%', length: 100, delay: '-11s', duration: '1.45s', travel: 260, travelY: 108 },
  { top: '68%', left: '22%', length: 160, delay: '-19s', duration: '1.9s', travel: 400, travelY: 165 },
  { top: '8%', left: '70%', length: 90, delay: '-27s', duration: '1.35s', travel: 230, travelY: 95 },
  { top: '80%', left: '78%', length: 120, delay: '-37s', duration: '1.6s', travel: 310, travelY: 128 },
] as const;

export function ShootingStars() {
  return (
    <div className={styles.layer} aria-hidden="true" data-shooting-star data-testid="shooting-stars">
      {STARS.map((star) => (
        <span
          key={`${star.top}-${star.left}`}
          className={styles.star}
          style={
            {
              top: star.top,
              left: star.left,
              width: `${star.size}px`,
              height: `${star.size}px`,
              '--twinkle-delay': star.delay,
              '--twinkle-duration': star.duration,
              '--max-opacity': star.max,
              '--min-opacity': Math.round(star.max * 0.35 * 100) / 100,
            } as React.CSSProperties
          }
        />
      ))}
      {METEORS.map((meteor) => (
        <span key={meteor.delay} className={styles.shootingLayer}>
          <span
            className={styles.shooting}
            style={
              {
                '--top': meteor.top,
                '--left': meteor.left,
                '--length': `${meteor.length}px`,
                '--delay': meteor.delay,
                '--duration': meteor.duration,
                '--travel': `${meteor.travel}px`,
                '--travel-y': `${meteor.travelY}px`,
              } as React.CSSProperties
            }
          />
          <span
            className={styles.shootingHead}
            style={
              {
                '--top': meteor.top,
                '--left': meteor.left,
                '--delay': meteor.delay,
                '--duration': meteor.duration,
                '--travel': `${meteor.travel}px`,
                '--travel-y': `${meteor.travelY}px`,
              } as React.CSSProperties
            }
          />
        </span>
      ))}
    </div>
  );
}
