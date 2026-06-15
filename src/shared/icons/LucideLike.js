/**
 * Lucide Like
 *
 * Purpose: Lucide Like — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: Home, Flame, Target, Activity, User, Trophy, Sparkles, Calendar
 *
 * @file-header
 */
import React from 'react';
import Svg, { Path } from 'react-native-svg';

const baseProps = {
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function Home({ size = 24, color = '#FFFFFF', strokeWidth = 1.75 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...baseProps} stroke={color} strokeWidth={strokeWidth}>
      <Path d="M3 10.5 12 3l9 7.5" />
      <Path d="M5 9.8V21h14V9.8" />
      <Path d="M9.5 21v-6.2h5V21" />
    </Svg>
  );
}

export function Flame({ size = 20, color = '#FFFFFF', strokeWidth = 1.5 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...baseProps} stroke={color} strokeWidth={strokeWidth}>
      {/* lucide "flame" */}
      <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 17c1.5 0 2.5-1 2.5-2.5 0-1.1-.6-2-1.6-2.4-.8-.3-1.4-1-1.4-1.9 0-1.3 1-2.3 2.3-2.3.6 0 1.2.2 1.6.6C15.4 6.6 14.7 4 12 2c0 0 .5 3-2 5-1.3 1-3 2.4-3 5.2C7 13.4 7.6 14.3 8.5 14.5Z" />
      <Path d="M12 22c4.4 0 8-3.6 8-8 0-3.1-1.6-5.3-3-7.2-.8-1.1-1.5-2.1-1.8-3.2" />
      <Path d="M7.8 3.6C7.3 5.2 6.3 6.5 5.2 7.8 3.8 9.5 2 11.6 2 14c0 4.4 3.6 8 8 8" />
    </Svg>
  );
}

export function Target({ size = 20, color = '#FFFFFF', strokeWidth = 1.5 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...baseProps} stroke={color} strokeWidth={strokeWidth}>
      {/* lucide "target" */}
      <Path d="M12 12m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" />
      <Path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
      <Path d="M12 2v3" />
      <Path d="M22 12h-3" />
      <Path d="M12 22v-3" />
      <Path d="M2 12h3" />
    </Svg>
  );
}

export function Activity({ size = 20, color = '#FFFFFF', strokeWidth = 1.5 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...baseProps} stroke={color} strokeWidth={strokeWidth}>
      {/* lucide "activity" */}
      <Path d="M22 12h-4l-3 9-6-18-3 9H2" />
    </Svg>
  );
}

export function User({ size = 24, color = '#FFFFFF', strokeWidth = 1.75 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...baseProps} stroke={color} strokeWidth={strokeWidth}>
      <Path d="M20 21a8 8 0 0 0-16 0" />
      <Path d="M12 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
    </Svg>
  );
}

export function Trophy({ size = 24, color = '#FFFFFF', strokeWidth = 1.75 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...baseProps} stroke={color} strokeWidth={strokeWidth}>
      <Path d="M8 21h8" />
      <Path d="M12 17v4" />
      <Path d="M7 4h10v3a5 5 0 0 1-10 0V4Z" />
      <Path d="M17 7h3a2 2 0 0 1-2 2h-1" />
      <Path d="M7 7H4a2 2 0 0 0 2 2h1" />
    </Svg>
  );
}

export function Sparkles({ size = 24, color = '#FFFFFF', strokeWidth = 1.75 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...baseProps} stroke={color} strokeWidth={strokeWidth}>
      <Path d="M12 2l1.2 3.8L17 7l-3.8 1.2L12 12l-1.2-3.8L7 7l3.8-1.2L12 2Z" />
      <Path d="M5 13l.8 2.5L8.5 16l-2.7.8L5 19l-.8-2.2L1.5 16l2.7-.5L5 13Z" />
      <Path d="M19 13l.8 2.5L22.5 16l-2.7.8L19 19l-.8-2.2L15.5 16l2.7-.5L19 13Z" />
    </Svg>
  );
}

export function Calendar({ size = 24, color = '#FFFFFF', strokeWidth = 1.75 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...baseProps} stroke={color} strokeWidth={strokeWidth}>
      <Path d="M8 2v4" />
      <Path d="M16 2v4" />
      <Path d="M3 8h18" />
      <Path d="M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
    </Svg>
  );
}

export function Shield({ size = 24, color = '#FFFFFF', strokeWidth = 1.75 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...baseProps} stroke={color} strokeWidth={strokeWidth}>
      <Path d="M12 2l7 4v6c0 5-3 9-7 10-4-1-7-5-7-10V6l7-4Z" />
      <Path d="M9 12l2 2 4-5" />
    </Svg>
  );
}

export function MessageCircle({ size = 24, color = '#FFFFFF', strokeWidth = 1.75 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...baseProps} stroke={color} strokeWidth={strokeWidth}>
      <Path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-3.5-.7L3 21l1.7-6A8.5 8.5 0 1 1 21 11.5Z" />
    </Svg>
  );
}

export function Sliders({ size = 24, color = '#FFFFFF', strokeWidth = 1.75 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...baseProps} stroke={color} strokeWidth={strokeWidth}>
      <Path d="M4 21v-7" />
      <Path d="M4 10V3" />
      <Path d="M12 21v-9" />
      <Path d="M12 8V3" />
      <Path d="M20 21v-5" />
      <Path d="M20 12V3" />
      <Path d="M2 14h4" />
      <Path d="M10 12h4" />
      <Path d="M18 16h4" />
    </Svg>
  );
}

export function Plus({ size = 24, color = '#FFFFFF', strokeWidth = 1.75 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...baseProps} stroke={color} strokeWidth={strokeWidth}>
      <Path d="M12 5v14" />
      <Path d="M5 12h14" />
    </Svg>
  );
}


