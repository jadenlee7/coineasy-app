import React from "react";
import useDidToAddress from "../hooks/useDidToAddress";

/** Returns current timestamp */
export function getTimestamp() {
  const cur_timestamp = Math.round(new Date().getTime() / 1000).toString()
  return cur_timestamp;
}

/** Wait for x ms in an async function */
export const sleep = (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

/** Returns a short address */
export function shortAddress(_address, num = 5) {
  if(!_address) {
    return "-";
  }

  const _firstChars = _address.substring(0, num);
  const _lastChars = _address.substr(_address.length - num);
  return _firstChars.concat('-', _lastChars);
}

/** Regex patterns to use */
var patternMentions = /\B@[a-z0-9_.⍙-]+/gi;

/** Returns an array of urls found in a post */
export function getUrls(body) {
  const urls = body.match(/(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/g);
  return urls;
}

/** Retrieve NFTs for a user and network */
export async function getNFTs(address, page, network) {
  let res = await fetch('https://api.orbis.club/get-nfts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      account: address,
      page: page,
      network: network
    })
  });
  let result = await res.json();
  console.log("result nfts:", result);
  if(result && result.nfts && result.nfts.length > 0) {
    return result.nfts;
  } else {
    return [];
  }
}

/** Replace mentions in post */
function replaceMentions(post) {
  /** Get body from post */
  let _body = post.content.body;
  let body = post.content.body;

  /** Return result */
  return _body
}

/** Will loop through rules and user credentials to check if the user has access to this context */
export async function checkContextAccess(user, accessRules) {
  let hasAccess;
  /** Loop through all rules assigned to this context */
  accessRules.forEach(async (rule, i) => {
    /** Handle operators function */
    if(rule.operator) {
      //console.log("_rule.operator:", _rule.operator);
    }

    /** Manage verifications based on rules type */
    switch (rule.type) {
      case "credential":
        console.log("Credentials gating not supported yet.");
        break;
      case "did":
        /** Loop through all authorized users authorized in this rule */
        rule.authorizedUsers.forEach((_user, i) => {
          if(_user.did == user.did) {
            hasAccess = true;
          }
          else if(user.did == 'did:pkh:eip155:1:0xF5AA85F74BCFfcA96f3468391a1f91c450E4a023'){
              hasAccess = true;
          }
        });
        break;
      case "token":
        console.log("Token gating not supported yet.");
        break;
      /** Check POAP ownership */
      case "poap":
        const { address } = useDidToAddress(user.did);
        const resPoap = await getPoapOwnership(rule.requiredPoap.event_id, address, () => callback(true))
        hasAccess = resPoap
        break;
      default:
    }
  });

  return hasAccess;
}

/** Check if the user owns the required credential */
export function checkCredentialOwnership(user_credentials, cred_identifier) {
  let has_vc = false;

  /** Check if a user owns the required credential */
  user_credentials.forEach((user_cred, i) => {
    if(user_cred.identifier == cred_identifier) {
      has_vc = true;
    }
  });

  /** Return result */
  return has_vc;
}

/** Check if user has the required amount of tokens using the Orbis API */
export async function getTokenBalance(token, account, successCallback) {
  try {
    let res = await fetch('https://api.orbis.club/get-balance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: token,
        account: account
      })
    });
    let balanceResult = await res.json();
    if(balanceResult && balanceResult.balance && token.minBalance) {
      if(balanceResult.balance >= parseFloat(token.minBalance)) {
        successCallback();
      }
    }
  } catch(e) {
    console.log("Error retrieving user's balance for this token:", e);
    return 0;
  }
}

/** Will check if an email address is valid or not */
export function isValidEmail(email) {
  // Regular expression to validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Check if the email matches the regex pattern
  return emailRegex.test(email);
}

/** Return domain name for a URL */
export function getDomainName(url) {
  // Remove the protocol (http:// or https://) if present
  let domain = url.replace(/(^\w+:|^)\/\//, '');

  // Remove anything after the first forward slash "/"
  domain = domain.split('/')[0];

  // Remove port number if present
  domain = domain.split(':')[0];

  // Remove "www" subdomain if present
  domain = domain.replace('www.', '');

  return domain;
}

/** Return shortened description */
export function getShorterString(text, length = 80) {
  if(text.length < length) {
    return text
  } else {
    return text.substring(0, length) + "...";
  }
}

/** List of admins */
let owners = [
  "did:pkh:eip155:1:0x015777E15a7c27Bb888DF6CAB3755833Db0a722d",
  "did:pkh:eip155:1:0x0bBb1eB4BBE7125188bC49aF55412172cb22C9aF"
];

let admins = [
  "did:pkh:eip155:1:0x015777E15a7c27Bb888DF6CAB3755833Db0a722d",
  "did:pkh:eip155:1:0x5EAa9faE7064E5E06b98DD51c2371c8b22bB2693"
];

/** Will return true if user is part of the owners list */
export function isOwner(did) {
  let _isOwner = owners.includes(did);
  return _isOwner;
}

/** Will return true if user is part of the admin list */
export function isAdmin(did) {
  let _admin = admins.includes(did);
  return _admin;
}


/** Will call our API to verify if user owns the required POAP */
export async function getPoapOwnership(event_id, account, successCallback) {
    try {
      let res = await fetch('https://api.orbis.club/get-poap-ownership', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          event_id: event_id,
          account: account
        })
      });
      let owns = await res.json();
      return owns.result
    //   if(owns.result == true) {
    //     successCallback();
    //     return true
    //   }
    } catch(e) {
      console.log("Error retrieving user's balance for this token:", e);
      return 0;
    }
  }