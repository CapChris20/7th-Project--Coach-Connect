import React from 'react';
import { SvgXml } from 'react-native-svg';
import frequency2SvgXml from '../../../assets/icons/frequency2SvgXml';

export default function FrequencyCalendarIcon({ size = 34 }) {
  return <SvgXml xml={frequency2SvgXml} width={size} height={size} />;
}
