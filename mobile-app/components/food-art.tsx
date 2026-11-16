import Svg, { Circle, Line, Path } from 'react-native-svg';

import type { FoodArt as FoodArtKind } from '@/data/recipes';

type Props = { kind: FoodArtKind; color: string; size?: number; strokeWidth?: number };

/** Line illustrations of each dish, drawn on a 64×64 grid. */
export function FoodArt({ kind, color, size = 56, strokeWidth = 2.5 }: Props) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {kind === 'bowl' && (
        <>
          <Path d="M10 34h44a22 22 0 0 1-44 0z" {...stroke} />
          <Circle cx="24" cy="28" r="2" {...stroke} />
          <Circle cx="34" cy="25" r="2" {...stroke} />
          <Circle cx="42" cy="29" r="2" {...stroke} />
          <Path d="M28 18c0-4 4-4 4-8M38 18c0-4 4-4 4-8" {...stroke} />
        </>
      )}
      {kind === 'quesadilla' && (
        <>
          <Path d="M8 40 32 16l24 24z" {...stroke} />
          <Path d="M20 40l12-12 12 12" {...stroke} />
          <Line x1="8" y1="46" x2="56" y2="46" {...stroke} />
        </>
      )}
      {kind === 'pan' && (
        <>
          <Circle cx="30" cy="34" r="18" {...stroke} />
          <Line x1="48" y1="34" x2="60" y2="34" {...stroke} />
          <Circle cx="30" cy="34" r="6" {...stroke} />
        </>
      )}
      {kind === 'wrap' && (
        <>
          <Path d="M12 22c8-8 32-8 40 0l-6 30H18z" {...stroke} />
          <Path d="M20 30c6 4 18 4 24 0" {...stroke} />
        </>
      )}
    </Svg>
  );
}
