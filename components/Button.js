import { TouchableOpacity, Text, TouchableHighlight, ActivityIndicator } from 'react-native';
import { useTailwind } from 'tailwind-rn';

export default function Button({icon, size, title, onPress, color, style, loading = false}) {
  const tailwind = useTailwind();

  /** Display differnt button color based on parameter passed */
  switch (color) {
    /** Transparent Button */
    case "gray-100":
      return(
        <TouchableOpacity activeOpacity={0.9}  style={[tailwind('bg-gray-100 px-5 py-3 rounded-full')], style} onPress={onPress}>
          <Text style={tailwind('text-slate-900 font-semibold')}>{title}</Text>
        </TouchableOpacity>
      );

    /** Default purple button */
    case "indigo-400":
      return(
        <TouchableOpacity activeOpacity={0.9}  style={[tailwind('bg-indigo-400 px-5 py-3 rounded-full'), style]} onPress={onPress}>
          <Text style={tailwind('text-white font-semibold')}>{title}</Text>
        </TouchableOpacity>
      );

    /** Default purple button */
    case "black":
      return(
        <TouchableOpacity activeOpacity={0.9}  style={[tailwind('bg-slate-900 px-5 py-3 rounded-full'), style]} onPress={onPress}>
          <Text style={tailwind('text-white font-semibold')}>{title}</Text>
        </TouchableOpacity>
      );

    /** Orange button (coineasy branding) */
    case "orange":
      switch (size) {
        case "sm":
          return(
            <TouchableOpacity activeOpacity={0.9}  style={[tailwind(`px-7 rounded-full border ${loading ? "bg-main-400" : "bg-main"}`), {borderColor: "transparent", paddingVertical: 5, ...style}]} onPress={onPress}>
              {loading ?
                <ActivityIndicator size="small" color="#fff" />
              :
                <Text style={tailwind('text-white font-semibold')}>{title}</Text>
              }

            </TouchableOpacity>
          );
        case "md":
          return(
            <TouchableOpacity activeOpacity={0.9}  style={[tailwind('px-7 py-3 rounded-full'), {backgroundColor: "#FF6B17", ...style}]} onPress={onPress}>
              <Text style={tailwind('text-white font-semibold')}>{title}</Text>
            </TouchableOpacity>
          );
        default:
          return(
            <TouchableOpacity activeOpacity={0.9}  style={[tailwind('px-7 py-3 rounded-full'), {backgroundColor: "#FF6B17", ...style}]} onPress={onPress}>
              <Text style={tailwind('text-white font-semibold')}>{title}</Text>
            </TouchableOpacity>
          );
      }
      
    /** White button */
    case "sm-white":
      return(
        <TouchableOpacity activeOpacity={0.9}  style={[tailwind(`px-7 rounded-full border ${loading ? "bg-slate-100" : "bg-white"}`), {borderColor: "#FF6B17", paddingVertical: 5, ...style}]} onPress={onPress} underlayColor="#f8fafc">
          <Text style={tailwind('text-slate-900 font-semibold')}>{title}</Text>
        </TouchableOpacity>
      );

    /** Transparent small button */
    case "sm-transparent":
      return(
        <TouchableOpacity activeOpacity={0.9}  style={[tailwind(`px-7 rounded-full`), { paddingVertical: 5, ...style }]} onPress={onPress} underlayColor="#f8fafc">
          <Text style={tailwind('text-slate-900 font-semibold')}>{title}</Text>
        </TouchableOpacity>
      );

    /** Bold & rounded gray button */
    case "rounded-gray":
      return(
        <TouchableHighlight style={[tailwind('bg-slate-100 rounded-full py-4 px-8 mt-2 flex-row items-center')]} onPress={onPress} underlayColor="#f8fafc">
          <>
            {icon}
            <Text style={[tailwind('text-center flex-1'), { fontSize: 14, fontFamily: "GmarketBold" }]}>{title}</Text>
          </>
        </TouchableHighlight>
      );

    /** Default purple button */
    default:
      return(
        <TouchableOpacity activeOpacity={0.9}  style={[tailwind('bg-indigo-600 px-5 py-3 rounded-full'), style]} onPress={onPress}>
          <Text style={tailwind('text-white font-semibold')}>{title}</Text>
        </TouchableOpacity>
      );
  }


}
