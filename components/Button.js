import { TouchableOpacity, Text, TouchableHighlight, ActivityIndicator } from 'react-native';
import { useTailwind } from 'tailwind-rn';

export default function Button({icon, iconRight, size, title, onPress, color, style, loading = false}) {
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
        case "xs":
          return(
            <TouchableOpacity activeOpacity={0.7}  style={[tailwind(`px-3 rounded-full border ${loading ? "bg-main-400" : "bg-main"}`), {borderColor: "transparent", paddingVertical: 5, ...style}]} onPress={onPress}>
              {loading ?
                <ActivityIndicator size="small" color="#fff" style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }} />
              :
                <Text style={[tailwind('text-white font-normal'), {fontSize: 10, lineHeight: 14}]}>{title}</Text>
              }

            </TouchableOpacity>
          );
        case "sm":
          return(
            <TouchableOpacity activeOpacity={0.7}  style={[tailwind(`px-5 rounded-full border ${loading ? "bg-main-400" : "bg-main"}`), {borderColor: "transparent", paddingVertical: loading ? 3.2 : 5, ...style}]} onPress={onPress}>
              {loading ?
                <ActivityIndicator size="small" color="#fff" style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }} />
              :
                <Text style={[tailwind('text-white font-semibold'), {fontSize: 12, lineHeight: 16}]}>{title}</Text>
              }

            </TouchableOpacity>
          );
        case "md":
          return(
            <TouchableOpacity activeOpacity={0.7}  style={[tailwind('px-7 py-3 rounded-full'), {backgroundColor: "#FF6B17", ...style}]} onPress={onPress}>
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

    case "green":
      switch (size) {
        case "sm":
        return(
          <TouchableOpacity activeOpacity={0.7}  style={[tailwind(`px-5 rounded-full items-center flex-row border ${loading ? "" : ""}`), {backgroundColor: "#87EE9B", borderColor: "transparent", paddingVertical: 4, ...style}]} onPress={onPress}>
            {loading ?
              <ActivityIndicator size="small" color="#fff" />
            :
              <>
                {icon}
                <Text style={[tailwind('font-semibold'), { fontSize: 12, lineHeight: 16, color: "#fff" }]}>{title}</Text>
              </>
            }

          </TouchableOpacity>
        );
          break;
        default:

      }

    case "green-border":
      switch (size) {
        case "sm":
        return(
          <TouchableOpacity activeOpacity={0.7}  style={[tailwind(`px-5 rounded-full items-center flex-row border ${loading ? "" : ""}`), {borderColor: "#46E57C", paddingVertical: 4, ...style}]} onPress={onPress}>
            {loading ?
              <ActivityIndicator size="small" color="#fff" />
            :
              <>
                {icon}
                <Text style={[tailwind('font-semibold'), { fontSize: 12, lineHeight: 16, color: "#46E57C" }]}>{title}</Text>
              </>
            }

          </TouchableOpacity>
        );
          break;
        default:

      }


    /** White button */
    case "white":
      switch (size) {
        case "sm":
          return(
            <TouchableOpacity activeOpacity={0.6} style={[tailwind(`px-5 rounded-full border flex-row items-center ${loading ? "bg-slate-100" : "bg-white"}`), {borderColor: "#FF6B17", paddingVertical: 5, ...style}]} onPress={onPress}>
              <Text style={[tailwind('text-main font-semibold items-center'), {fontSize: 12, lineHeight: 16,}]}>{title}</Text>
              {iconRight}
            </TouchableOpacity>
          );
        default:
          return;
      }

    /** Transparent small button */
    case "sm-transparent":
      return(
        <TouchableOpacity activeOpacity={0.9}  style={[tailwind(`px-7 rounded-full`), { paddingVertical: 5, ...style }]} onPress={onPress} underlayColor="#f8fafc">
          <Text style={tailwind('text-secondary')}>{title}</Text>
        </TouchableOpacity>
      );

    /** Bold & rounded gray button */
    case "rounded-gray":
      return(
        <TouchableHighlight style={[tailwind('bg-slate-100 rounded-full py-4 px-8 flex-row items-center justify-center'), { ...style }]} onPress={onPress} underlayColor="#f8fafc">
          <>
            {icon}
            <Text style={[tailwind('text-center'), { fontSize: 14, fontFamily: "GmarketBold", lineHeight: 18 }]}>{title}</Text>
          </>
        </TouchableHighlight>
      );

    /** Bold & rounded red button */
    case "rounded-red":
      return(
        <TouchableHighlight style={[tailwind('bg-slate-100 rounded-full py-4 px-8 flex-row items-center'), { ...style }]} onPress={onPress} underlayColor="#f8fafc">
          <>
            {icon}
            <Text style={[tailwind('text-center flex-1'), { fontSize: 14, fontFamily: "GmarketBold", lineHeight: 18, color: "#FF0000" }]}>{title}</Text>
          </>
        </TouchableHighlight>
      );

    case "badge-gray":
      return(
        <TouchableOpacity style={[tailwind('px-3 py-1 rounded-full flex flex-row items-center'), {backgroundColor: "#959595", ...style}]} activeOpacity={0.7} onPress={onPress}>
          <Text style={[tailwind("text-secondary"), {color: "#FFF", fontSize: 11}]}>{title}</Text>
          {icon}
        </TouchableOpacity>
      )

    /** Default purple button */
    default:
      return(
        <TouchableOpacity activeOpacity={0.9}  style={[tailwind('bg-indigo-600 px-5 py-3 rounded-full'), style]} onPress={onPress}>
          <Text style={tailwind('text-white font-semibold')}>{title}</Text>
        </TouchableOpacity>
      );
  }


}
