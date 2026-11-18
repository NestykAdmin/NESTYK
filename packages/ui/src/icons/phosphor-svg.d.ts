// F7: deep icon imports make tsc read phosphor-react-native's own .tsx source, whose icon-base passes
// `className` to <Svg> (react-native-svg forwards it on web). Type-only: no runtime effect.
import 'react-native-svg';

declare module 'react-native-svg' {
  interface SvgProps {
    className?: string;
  }
}
