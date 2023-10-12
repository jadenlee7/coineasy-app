import { shortAddress } from "../utils";

export default function useGetMentionedDid(match, mentions) {
  let _did;
  mentions?.forEach((mention, i) => {
    if(mention.username == "@" + match) {
      _did = mention.did;
    }
  });
  return _did;
}
