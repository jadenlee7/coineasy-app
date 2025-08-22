const courseObject = {
    title: "Education Title",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ultrices, magna vitae eleifend placerat, turpis lectus maximus libero, sed egestas enim",
    bottomDescription: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ultrices, magna vitae eleifend placerat, turpis lectus maximus libero, sed egestas enim consectetur consectetur adipiscing elit. Etiam ultrices, magna vitae eleifend placerat.. Etiam ultrices, magna vitae eleifend placerat.. Etiam ultrices, magna vitae eleifend placerat.. Etiam ultrices, magna vitae eleifend placerat.. Etiam ultrices, magna vitae eleifend placerat.. Etiam ultrices, magna vitae eleifend placerat.. Etiam ultrices, magna vitae eleifend placerat."
}

export const giftData = [
    {
      id: 1,
      title: 'Americano',
      subtitle: 'Starbucks (Korea)',
      date: '2025-06-10 17:31',
      barCodeText: "9350138321499185",
      status: 'Available'
    },
    {
      id: 2,
      title: 'Americano',
      subtitle: 'Starbucks (Korea)',
      date: '2025-06-09 11:28',
      barCodeText: "9350259456387152",
      status: 'Available'
    },
    {
      id: 3,
      title: 'Americano',
      subtitle: 'Starbucks (Korea)',
      date: '2025-06-03 19:47',
      barCodeText: "9350974128462384",
      status: 'Used'
    },
    {
      id: 4,
      title: 'Americano',
      subtitle: 'Starbucks (Korea)',
      date: '2025-06-02 20:02',
      barCodeText: "9350345687421547",
      status: 'Used'
    },
  ];

export const shopData = [
    {
      id: 1,
      title: 'Starbucks Gifticon Entry',
      subtitle: 'Winning Chance 2%',
      remainer: 48,
      total: 120,
      oranges: 120,
      image: require('../assets/starbucks_gifticon.png'),
      buttonText: 'Join',
      successText: "You've received a Starbucks Gifticon!",
      loseText: "You didn't win the Starbucks Gifticon entry."
    },
    {
      id: 2,
      title: '1 Coffee',
      subtitle: 'Guaranteed Coffee Coupon',
      remainer: 0,
      total: 1000,
      oranges: 120,
      image: require('../assets/starbucks_coffee.png'),
      buttonText: 'Apply',
      successText: "You've received a free cup of coffee!",
      loseText: "You didn't win the free cup of coffee."
    },
    {
      id: 3,
      title: 'Easycon whitelist',
      subtitle: 'Priority Entry',
      remainer: 0,
      total: 1000,
      oranges: 1000,
      image: require('../assets/trophy/trophy_placeholder.png'),
      buttonText: 'Closed',
      successText: "You're registered in the Easycon Whitelist!",
      loseText: "You didn't win the Easycon Whitelist entry."
    },
    {
      id: 4,
      title: '1 Coffee',
      subtitle: 'Guaranteed Coffee Coupon',
      remainer: 0,
      total: 1000,
      oranges: 120,
      image: require('../assets/starbucks_coffee.png'),
      buttonText: 'Apply',
      successText: "You've received a free cup of coffee!",
      loseText: "You didn't win the free cup of coffee."
    },
  ];

export const courses = [
    // TROPHIE COINEASY
    
    {
        id: 1,
        title: 'Beginner',
        participants: '12,000',
        description: 'Learn the fundamentals of blockchain, crypto, and how to navigate Web3',
        reward: 200,
        image_icon: require('../assets/trophy/trophy_book.png'),
        category: 'coineasy',
        sections: [
            {
                id: '1-1',
                title: 'What is Blockchain?',
                description: 'In this course, you’ll get an introduction to blockchain technology and why it’s transforming the world.',
                image: require('../assets/trophy/coineasy/what.webp'),
                points: 60,
                enrolled: 12000,
                pages: [
                    {
                        title: "Understanding Blockchain",
                        description: "Blockchain is a type of database that stores information in blocks linked together in a chain. Once data is recorded, it’s extremely difficult to change — making it secure and transparent.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/what_page1.webp')
                    },
                    {
                        title: "Why Blockchain Matters",
                        description: "Because it’s decentralized, no single person or company controls it. Anyone can participate, verify transactions, and trust the system without relying on a middleman.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/what_page1.webp')
                    },
                ],
                question: {
                    question: "Blockchain is best described as:",
                    options: [
                        { id: 0, text: 'A type of social media', isCorrect: false },
                        { id: 1, text: 'A decentralized digital ledger', isCorrect: true },
                        { id: 2, text: 'A centralized database', isCorrect: false },
                        { id: 3, text: 'A type of cryptocurrency', isCorrect: false },
                    ],
                }
            },
            {
                id: '1-2',
                title: 'How Does Blockchain Work?',
                description: 'In this course, you will learn how blockchain records, links, and secures information.',
                image: require('../assets/trophy/coineasy/work.webp'),
                points: 60,
                enrolled: 12000,
                pages: [
                    {
                        title: "Blocks and Transactions",
                        description: "A blockchain stores information in digital blocks, each containing transaction details, a time stamp, and a unique code called a hash.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/work_page1.webp')
                    },
                    {
                        title: "Linking Blocks",
                        description: "Each new block includes the hash of the previous block, creating a chain that makes it easy to detect and prevent tampering.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/work_page2.webp')
                    },
                    {
                        title: "Consensus Mechanisms",
                        description: "Before a block is added, many computers on the network check and agree that the information is correct, using a process called consensus.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/work_page3.webp')
                    },
                ],
                question: {
                    question: "Which process ensures that transactions on a blockchain are valid?",
                    options: [
                        { id: 0, text: 'Consensus mechanism', isCorrect: true },
                        { id: 1, text: 'Web hosting', isCorrect: false },
                        { id: 2, text: 'File sharing', isCorrect: false },
                        { id: 3, text: 'Central banking', isCorrect: false },
                    ],
                }
            },
            {
                id: '1-3',
                title: 'Types of Blockchains',
                description: 'In this course, you’ll explore the different types of blockchains and their real-world uses.',
                image: require('../assets/trophy/coineasy/blockchain.webp'),
                points: 60,
                enrolled: 12000,
                pages: [
                    {
                        title: "Public Blockchains",
                        description: "A public blockchain is an open network where anyone can join without restrictions, verify transactions, and view the entire history publicly, making it fully decentralized; examples include Bitcoin and Ethereum.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/blockchain_page1.webp')
                    },
                    {
                        title: "Private Blockchains",
                        description: "A private blockchain is a closed network where only authorized individuals or organizations can join, often controlled by a single entity and used for business operations that require privacy, such as Corda or Ripple.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/blockchain_page2.webp')
                    },
                    {
                        title: "Hybrid & Consortium",
                        description: "A consortium blockchain is a hybrid that combines features of public and private blockchains, managed by a group of organizations that share data while limiting access to approved participants, with examples like Hyperledger.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/blockchain_page3.webp')
                    },
                ],
                question: {
                    question: "Bitcoin runs on which type of blockchain?",
                    options: [
                        { id: 0, text: 'Private', isCorrect: false },
                        { id: 1, text: 'Public', isCorrect: true },
                        { id: 2, text: 'Hybrid', isCorrect: false },
                        { id: 3, text: 'Consortium', isCorrect: false },
                    ],
                }
            },
            {
                id: '1-4',
                title: 'What is Cryptocurrency?',
                description: 'In this course, you will learn what cryptocurrency is and why people use it as digital money.',
                image: require('../assets/trophy/coineasy/crypto.webp'),
                points: 60,
                enrolled: 12000,
                pages: [
                    {
                        title: "Digital Money",
                        description: "Cryptocurrency is a type of digital money that exists only online and uses blockchain technology to record and secure transactions.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/crypto_page1.webp')
                    },
                    {
                        title: "No Middleman",
                        description: "It allows people to send and receive payments directly to each other without needing a bank or payment company in the middle.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/crypto_page2.webp')
                    },
                    {
                        title: "Many Types",
                        description: "There are thousands of different cryptocurrencies, with popular examples including Bitcoin, Ethereum, and Dogecoin.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/crypto_page3.webp')
                    },
                ],
                question: {
                    question: "Which of the following is NOT a cryptocurrency?",
                    options: [
                        { id: 0, text: 'Bitcoin', isCorrect: false },
                        { id: 1, text: 'Ethereum', isCorrect: false },
                        { id: 2, text: 'Dollar bill', isCorrect: true },
                        { id: 3, text: 'Dogecoin', isCorrect: false },
                    ],
                }
            },
            {
                id: '1-5',
                title: 'What is Bitcoin?',
                description: 'In this course, you will learn what Bitcoin is, how it works, and why it is important.',
                image: require('../assets/trophy/coineasy/bitcoin.webp'),
                points: 60,
                enrolled: 12000,
                pages: [
                    {
                        title: "The First Cryptocurrency",
                        description: "Bitcoin is the first cryptocurrency, created in 2009 to let people send money directly to each other without banks, and in 2010 it was famously used to buy two pizzas for 10,000 BTC — the first real-world Bitcoin purchase.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/bitcoin_page1.webp')
                    },
                    {
                        title: "How It Works",
                        description: "Bitcoin transactions are recorded on a public blockchain and verified by a network of computers through a process called mining.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/bitcoin_page2.webp')
                    },
                    {
                        title: "Limited Supply",
                        description: "Only 21 million Bitcoins will ever exist, which makes it scarce and one reason why people see it as valuable.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/bitcoin_page3.webp')
                    },
                ],
                question: {
                    question: "What is the maximum supply of Bitcoin?",
                    options: [
                        { id: 0, text: '10 million', isCorrect: false },
                        { id: 1, text: '21 million', isCorrect: true },
                        { id: 2, text: 'Unlimited', isCorrect: false },
                        { id: 3, text: '100 million', isCorrect: false },
                    ],
                }
            },
            {
                id: '1-6',
                title: 'Who is Satoshi Nakamoto?',
                description: 'In this course, you will learn about the mysterious creator of Bitcoin and the impact they left on the world.',
                image: require('../assets/trophy/coineasy/satoshi.webp'),
                points: 60,
                enrolled: 12000,
                pages: [
                    {
                        title: "The Creator",
                        description: "Satoshi Nakamoto is the anonymous person or group who created Bitcoin and published its whitepaper in 2008.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/satoshi_page1.webp')
                    },
                    {
                        title: "The Disappearance",
                        description: "After launching Bitcoin in 2009 and communicating with early developers, Satoshi stopped all public activity in 2011 and has never been heard from again.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/satoshi_page2.webp')
                    },
                    {
                        title: "The Mystery",
                        description: "No one knows Satoshi’s true identity, and their Bitcoin wallet — holding over 1 million BTC — has never been moved, adding to the mystery.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/satoshi_page3.webp')
                    },
                ],
                question: {
                    question: "Satoshi Nakamoto is:",
                    options: [
                        { id: 0, text: 'The creator of Bitcoin', isCorrect: true },
                        { id: 1, text: 'A famous singer', isCorrect: false },
                        { id: 2, text: 'A government agency', isCorrect: false },
                        { id: 3, text: 'A crypto exchange', isCorrect: false },
                    ],
                }
            },
            {
                id: '1-7',
                title: 'What is Ethereum?',
                description: 'In this course, you will learn what a crypto wallet is, why you need one, and the different types that exist.',
                image: require('../assets/trophy/coineasy/ethereum.webp'),
                points: 60,
                enrolled: 12000,
                pages: [
                    {
                        title: "Beyond Digital Money",
                        description: "Ethereum is a blockchain launched in 2015 that not only supports digital money but also allows developers to build apps and programs directly on the network.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/ethereum_page1.webp')
                    },
                    {
                        title: "Smart Contracts",
                        description: "It introduced smart contracts, which are programs that automatically run when certain conditions are met, enabling services like DeFi and NFTs.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/ethereum_page2.webp')
                    },
                    {
                        title: "The Currency",
                        description: "Ethereum’s native cryptocurrency is called Ether (ETH), and it is used to pay for transactions, run apps, and interact with smart contracts on the network.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/ethereum_page3.webp')
                    },
                ],
                question: {
                    question: "What is the native cryptocurrency of Ethereum?",
                    options: [
                        { id: 0, text: 'ETH', isCorrect: true },
                        { id: 1, text: 'BTC', isCorrect: false },
                        { id: 2, text: 'SOL', isCorrect: false },
                        { id: 3, text: 'DOGE', isCorrect: false },
                    ],
                }
            },
            {
                id: '1-8',
                title: 'What is a Crypto Wallet?',
                description: 'In this course, you will learn what a crypto wallet is, why you need one, and the different types that exist.',
                image: require('../assets/trophy/coineasy/crypto_wallet.webp'),
                points: 60,
                enrolled: 12000,
                pages: [
                    {
                        title: "The Definition",
                        description: "A crypto wallet is a tool, either an app or a physical device, that stores the private keys you need to access and send your cryptocurrency.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/crypto_wallet_page1.webp')
                    },
                    {
                        title: "How It Works",
                        description: "Instead of storing coins like a physical wallet, it stores your private keys, which prove your ownership of cryptocurrency on the blockchain.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/crypto_wallet_page2.webp')
                    },
                    {
                        title: "Wallet Types",
                        description: "There are hardware wallets, which are physical devices that store keys offline, software wallets, which are apps or programs connected to the internet, hot wallets, which stay online for quick access, and cold wallets, which remain offline for stronger security.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/crypto_wallet_page3.webp')
                    },
                ],
                question: {
                    question: "Which wallet type stays completely offline for maximum security?",
                    options: [
                        { id: 0, text: 'Hot wallet', isCorrect: false },
                        { id: 1, text: 'Cold wallet', isCorrect: true },
                        { id: 2, text: 'Software wallet', isCorrect: false },
                        { id: 3, text: 'Hardware wallet', isCorrect: false },
                    ],
                }
            },

            {
                id: '1-9',
                title: 'What is a Crypto Exchange?',
                description: 'In this course, you will learn what a crypto exchange is, how it works, and the difference between centralized and decentralized exchanges.',
                image: require('../assets/trophy/coineasy/exchange.webp'),
                points: 60,
                enrolled: 12000,
                pages: [
                    {
                        title: "The Definition",
                        description: "A crypto exchange is a platform where people can buy, sell, and trade cryptocurrencies using other cryptocurrencies or traditional money.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/exchange_page1.webp')
                    },
                    {
                        title: "Centralized Exchange (CEX)",
                        description: "A centralized exchange is run by a company that manages your account, holds your funds, and processes trades for you, with popular examples including Binance and Coinbase.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/exchange_page2.webp')
                    },
                    {
                        title: "Decentralized Exchange (DEX)",
                        description: "A decentralized exchange lets people trade directly with each other using smart contracts, without giving control of their funds to a central company, with examples like Uniswap and PancakeSwap.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/exchange_page3.webp')
                    },
                ],
                question: {
                    question: "Which type of exchange lets you trade without giving control of your funds to a company?",
                    options: [
                        { id: 0, text: 'Centralized exchange', isCorrect: false },
                        { id: 1, text: 'Decentralized exchange', isCorrect: true },
                        { id: 2, text: 'Stock exchange', isCorrect: false },
                        { id: 3, text: 'Bank', isCorrect: false },
                    ],
                }
            },
            {
                id: '1-10',
                title: 'How to Keep Your Crypto Safe',
                description: 'In this course, you will learn simple and effective ways to protect your cryptocurrency from theft and loss.',
                image: require('../assets/trophy/coineasy/safe.webp'),
                points: 60,
                enrolled: 12000,
                pages: [
                    {
                        title: "Use Secure Wallets",
                        description: "Always store your crypto in a secure wallet, preferably a hardware or cold wallet, to keep your private keys safe from online attacks.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/safe_page1.webp')
                    },
                    {
                        title: "Protect Your Keys",
                        description: "Never share your private keys or recovery phrases with anyone, and store them in a safe offline location that only you can access.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/safe_page2.webp')
                    },
                    {
                        title: "Beware of Scams",
                        description: "Be cautious of phishing emails, fake websites, and suspicious links, and always double-check addresses before sending any crypto.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/safe_page3.webp')
                    },
                ],
                question: {
                    question: "What is the most important thing to keep private in order to protect your crypto?",
                    options: [
                        { id: 0, text: 'Your wallet balance', isCorrect: false },
                        { id: 1, text: 'Your private keys', isCorrect: true },
                        { id: 2, text: 'Your transaction history', isCorrect: false },
                        { id: 3, text: 'Your wallet app', isCorrect: false },
                    ],
                }
            },
            {
                id: '1-11',
                title: 'What is a Stablecoin?',
                description: 'In this course, you will learn what a stablecoin is and why it is useful in crypto.',
                image: require('../assets/trophy/coineasy/stablecoin.webp'),
                points: 60,
                enrolled: 12000,
                pages: [
                    {
                        title: "The Definition",
                        description: "A stablecoin is a type of cryptocurrency that is designed to keep its value stable, usually by being tied to something like the US dollar.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/stablecoin_page1.webp')
                    },
                    {
                        title: "How It Works",
                        description: "For every stablecoin issued, there is usually a reserve of money or assets backing it, which helps maintain its price stability.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/stablecoin_page2.webp')
                    },
                    {
                        title: "Why It Matters",
                        description: "Stablecoins are important because they let people trade, save, and move money in crypto without worrying about big price swings like Bitcoin or Ethereum.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy/stablecoin_page3.webp')
                    },
                ],
                question: {
                    question: "What makes a stablecoin “stable”?",
                    options: [
                        { id: 0, text: 'It has unlimited supply', isCorrect: false },
                        { id: 1, text: 'It is backed by money or assets', isCorrect: true },
                        { id: 2, text: 'It grows in value every year', isCorrect: false },
                        { id: 3, text: 'It cannot be traded', isCorrect: false },
                    ],
                }
            },
        ]
    },
    {
        id: 2,
        title: 'Intermediate',
        participants: '12,000',
        description: 'Dive deeper into DeFi, security, and the latest Web3 innovations.',
        reward: 200,
        image_icon: require('../assets/trophy/trophy_orange.png'),
        category: 'coineasy',
        sections: [
            {
                id: '2-1',
                title: 'What is 1inch?',
                description: 'In this course, you will learn everything you need to know about 1inch!',
                image: require('../assets/trophy/trophy_ninja_bg_image.png'),
                points: 60,
                enrolled: 12000,
                pages: Array.from({ length: 14 }, () => ({ ...courseObject })),
                question: {
                    question: "What is this?",
                    options: [
                        { id: 0, text: 'Coin easy 1', isCorrect: false },
                        { id: 1, text: 'Coin easy 2', isCorrect: true },
                        { id: 2, text: 'Coin easy 3', isCorrect: false },
                        { id: 3, text: 'Coin easy 4', isCorrect: false },
                    ],
                }
            },
            {
                id: '2-2',
                title: 'What is 1inch?',
                description: 'In this course, you will learn everything you need to know about 1inch!',
                image: require('../assets/trophy/trophy_ninja_bg_image.png'),
                points: 60,
                enrolled: 12000,
                pages: Array.from({ length: 14 }, () => ({ ...courseObject })),
                question: {
                    question: "What is this?",
                    options: [
                        { id: 0, text: 'Coin easy 1', isCorrect: false },
                        { id: 1, text: 'Coin easy 2', isCorrect: true },
                        { id: 2, text: 'Coin easy 3', isCorrect: false },
                        { id: 3, text: 'Coin easy 4', isCorrect: false },
                    ],
                }
            },
            {
                id: '2-3',
                title: 'What is 1inch?',
                description: 'In this course, you will learn everything you need to know about 1inch!',
                image: require('../assets/trophy/trophy_ninja_bg_image.png'),
                points: 60,
                enrolled: 12000,
                pages: Array.from({ length: 14 }, () => ({ ...courseObject })),
                question: {
                    question: "What is this?",
                    options: [
                        { id: 0, text: 'Coin easy 1', isCorrect: false },
                        { id: 1, text: 'Coin easy 2', isCorrect: true },
                        { id: 2, text: 'Coin easy 3', isCorrect: false },
                        { id: 3, text: 'Coin easy 4', isCorrect: false },
                    ],
                }
            },
            {
                id: '2-4',
                title: 'What is 1inch?',
                description: 'In this course, you will learn everything you need to know about 1inch!',
                image: require('../assets/trophy/trophy_ninja_bg_image.png'),
                points: 60,
                enrolled: 12000,
                pages: Array.from({ length: 14 }, () => ({ ...courseObject })),
                question: {
                    question: "What is this?",
                    options: [
                        { id: 0, text: 'Coin easy 1', isCorrect: false },
                        { id: 1, text: 'Coin easy 2', isCorrect: true },
                        { id: 2, text: 'Coin easy 3', isCorrect: false },
                        { id: 3, text: 'Coin easy 4', isCorrect: false },
                    ],
                }
            },
        ]
    },
    {
        id: 3,
        title: 'Advanced',
        participants: '12,000',
        description: 'Master advanced blockchain concepts, investment strategies, and technical aspects.',
        reward: 200,
        image_icon: require('../assets/trophy/trophy_education.png'),
        category: 'coineasy',
        sections: [
            {
                id: '3-1',
                title: 'What is 1inch?',
                description: 'In this course, you will learn everything you need to know about 1inch!',
                image: require('../assets/trophy/trophy_ninja_bg_image.png'),
                points: 60,
                enrolled: 12000,
                pages: Array.from({ length: 14 }, () => ({ ...courseObject })),
                question: {
                    question: "What is this?",
                    options: [
                        { id: 0, text: 'Coin easy 1', isCorrect: false },
                        { id: 1, text: 'Coin easy 2', isCorrect: true },
                        { id: 2, text: 'Coin easy 3', isCorrect: false },
                        { id: 3, text: 'Coin easy 4', isCorrect: false },
                    ],
                }
            },
            {
                id: '3-2',
                title: 'What is 1inch?',
                description: 'In this course, you will learn everything you need to know about 1inch!',
                image: require('../assets/trophy/trophy_ninja_bg_image.png'),
                points: 60,
                enrolled: 12000,
                pages: Array.from({ length: 14 }, () => ({ ...courseObject })),
                question: {
                    question: "What is this?",
                    options: [
                        { id: 0, text: 'Coin easy 1', isCorrect: false },
                        { id: 1, text: 'Coin easy 2', isCorrect: true },
                        { id: 2, text: 'Coin easy 3', isCorrect: false },
                        { id: 3, text: 'Coin easy 4', isCorrect: false },
                    ],
                }
            },
            {
                id: '3-3',
                title: 'What is 1inch?',
                description: 'In this course, you will learn everything you need to know about 1inch!',
                image: require('../assets/trophy/trophy_ninja_bg_image.png'),
                points: 60,
                enrolled: 12000,
                pages: Array.from({ length: 14 }, () => ({ ...courseObject })),
                question: {
                    question: "What is this?",
                    options: [
                        { id: 0, text: 'Coin easy 1', isCorrect: false },
                        { id: 1, text: 'Coin easy 2', isCorrect: true },
                        { id: 2, text: 'Coin easy 3', isCorrect: false },
                        { id: 3, text: 'Coin easy 4', isCorrect: false },
                    ],
                }
            },
            {
                id: '3-4',
                title: 'What is 1inch?',
                description: 'In this course, you will learn everything you need to know about 1inch!',
                image: require('../assets/trophy/trophy_ninja_bg_image.png'),
                points: 60,
                enrolled: 12000,
                pages: Array.from({ length: 14 }, () => ({ ...courseObject })),
                question: {
                    question: "What is this?",
                    options: [
                        { id: 0, text: 'Coin easy 1', isCorrect: false },
                        { id: 1, text: 'Coin easy 2', isCorrect: true },
                        { id: 2, text: 'Coin easy 3', isCorrect: false },
                        { id: 3, text: 'Coin easy 4', isCorrect: false },
                    ],
                }
            },
        ]
    },

    // TROPHIE PROJECT
    {
        id: 4,
        title: 'Vana',
        participants: '12,000',
        description: 'VANA is a decentralized AI data network',
        reward: 200,
        image_icon: require('../assets/trophy/trophy_vana.png'),
        category: 'project',
        sections: [
            {
                id: '4-1',
                title: 'What is Vana?',
                description: 'In this course, you’ll get an introduction to Vana and how it works in the decentralized data economy!',
                image: require('../assets/trophy/project/vana.webp'),
                points: 60,
                enrolled: 12000,
                pages: [
                    {
                        title: "What is Vana?",
                        description: "Vana is a decentralized data protocol that enables individuals to own, control, and monetize their data. It connects data providers and AI/DeFi applications through secure, privacy-preserving infrastructure. Users can share data with confidence, earn rewards, and contribute to the growth of the AI and Web3 ecosystem.",
                        bottomDescription: "",
                        image: null
                    },
                    {
                        title: "Data Collectives",
                        description: "Vana’s Data Collectives allow communities to pool their data for specific purposes, such as training AI models or powering DeFi protocols, while maintaining full user control. This creates a new data economy where value flows back to the people who generate the data.",
                        bottomDescription: "",
                        image: null
                    },
                ],
                question: {
                    question: "What is Vana mainly used for?",
                    options: [
                        { id: 0, text: 'A centralized exchange', isCorrect: false },
                        { id: 1, text: 'A decentralized data protocol', isCorrect: true },
                        { id: 2, text: 'A hardware wallet', isCorrect: false },
                        { id: 3, text: 'A mining protocol', isCorrect: false },
                    ],
                }
            },
        ]
    },
    {
        id: 5,
        title: '1inch',
        participants: '12,000',
        description: 'In this course, you’ll get an introduction to 1inch and how it works in the DeFi world!',
        reward: 200,
        image_icon: require('../assets/trophy/trophy_1inch.png'),
        category: 'project',
        sections: [
            {
                id: '5-1',
                title: 'What is 1inch?',
                description: 'In this course, you’ll get an introduction to 1inch and how it works in the DeFi world!',
                image: require('../assets/trophy/project/1inch.webp'),
                points: 60,
                enrolled: 12000,
                pages: [
                    {
                        title: "What is 1inch?",
                        description: "1inch is a DeFi aggregator that integrates multiple DEXs to provide the most efficient swap routes. Users can find the best trading conditions with minimal slippage through 1inch.",
                        bottomDescription: "",
                        image: null
                    },
                    {
                        title: "Fusion Swap",
                        description: "1inch Fusion Swap allows users to trade at the best price with zero gas fees. It automatically matches orders with liquidity providers, enabling fast and efficient cross-chain swaps.",
                        bottomDescription: "",
                        image: null
                    },
                ],
                question: {
                    question: "What is 1inch mainly used for?",
                    options: [
                        { id: 0, text: 'A centralized exchange', isCorrect: false },
                        { id: 1, text: 'A DeFi aggregator', isCorrect: true },
                        { id: 2, text: 'A hardware wallet', isCorrect: false },
                        { id: 3, text: 'A mining protocol', isCorrect: false },
                    ],
                }
            },
        ]
    },
    
    {
        id: 6,
        title: 'Sonic',
        participants: '12,000',
        description: 'The peak of EVM performance. Designed for builders to scale and earn.',
        reward: 200,
        image_icon: require('../assets/trophy/trophy_sonic.png'),
        category: 'project',
        sections: [
            {
                id: '6-1',
                title: 'What is Sonic?',
                description: 'In this course, you’ll get an introduction to Sonic and how it works in the DeFi and Web3 world!',
                image: require('../assets/trophy/project/sonic.webp'),
                points: 60,
                enrolled: 12000,
                pages: [
                    {
                        title: "What is Sonic?",
                        description: "Sonic is a high-performance Layer 1 blockchain designed for ultra-fast transactions, low fees, and developer-friendly infrastructure. It enables builders to create scalable DeFi, GameFi, and Web3 applications without compromising speed or security. Users can enjoy seamless transactions, near-instant finality, and access to a growing ecosystem of decentralized applications.",
                        bottomDescription: "",
                        image: null
                    },
                    {
                        title: "High Performance",
                        description: "With Sonic’s high throughput and sub-second finality, projects can scale to millions of users while keeping costs minimal. Its ecosystem includes top DeFi apps, cross-chain integrations, and tools for both developers and everyday users.",
                        bottomDescription: "",
                        image: null
                    },
                ],
                question: {
                    question: "What is Sonic mainly used for?",
                    options: [
                        { id: 0, text: 'A centralized exchange', isCorrect: false },
                        { id: 1, text: 'A high-performance Layer', isCorrect: true },
                        { id: 2, text: 'A hardware wallet', isCorrect: false },
                        { id: 3, text: 'A mining protocol', isCorrect: false },
                    ],
                }
            },
        ]
    },
    {
        id: 7,
        title: 'Flock.io',
        participants: '12,000',
        description: 'The peak of EVM performance. Designed for builders to scale and earn.',
        reward: 200,
        image_icon: require('../assets/trophy/trophy_flock.png'),
        category: 'project',
        sections: [
            {
                id: '7-1',
                title: 'What is FLock?',
                description: 'In this course, you’ll get an introduction to FLock and how it works in the decentralized AI world!',
                image: require('../assets/trophy/project/sonic.webp'),
                points: 60,
                enrolled: 12000,
                pages: [
                    {
                        title: "What is FLock?",
                        description: "FLock is a decentralized federated learning protocol that enables AI models to be trained collaboratively without sharing raw data. It connects data owners and AI developers through a secure, privacy-preserving network. Users can contribute data locally, earn rewards, and help improve AI models while maintaining full control of their information.",
                        bottomDescription: "",
                        image: null
                    },
                    {
                        title: "Federated Learning",
                        description: "With FLock’s federated learning framework, multiple participants can train AI models together by only sharing model updates, not the data itself. This approach preserves privacy, enhances security, and accelerates the creation of high-quality AI applications.",
                        bottomDescription: "",
                        image: null
                    },
                ],
                question: {
                    question: "What is FLock mainly used for?",
                    options: [
                        { id: 0, text: 'A centralized exchange', isCorrect: false },
                        { id: 1, text: 'A decentralized federated learning protocol', isCorrect: true },
                        { id: 2, text: 'A hardware wallet', isCorrect: false },
                        { id: 3, text: 'A mining protocol', isCorrect: false },
                    ],
                }
            },
        ]
    },
    {
        id: 8,
        title: 'Yala',
        participants: '12,000',
        description: 'A liquidity layer to unlock Bitcoin’s untapped yield across DeFi and RWAs.',
        reward: 200,
        image_icon: require('../assets/trophy/trophy_yala.png'),
        category: 'project',
        sections: [
            {
                id: '8-1',
                title: 'What is Yala?',
                description: 'In this course, you’ll get an introduction to Yala and how it works in the stablecoin and DeFi ecosystem!',
                image: require('../assets/trophy/project/yala.webp'),
                points: 60,
                enrolled: 12000,
                pages: [
                    {
                        title: "What is Yala?",
                        description: "Yala is a decentralized stablecoin protocol that issues $YU, a Bitcoin-backed stablecoin designed for stability, security, and cross-chain usability. It provides overcollateralized minting with BTC and stablecoins, ensuring a reliable peg to $1 while enabling capital efficiency. Users can mint, trade, and use $YU across multiple chains, participate in liquidity pools, and earn rewards through staking.",
                        bottomDescription: "",
                        image: null
                    },
                    {
                        title: "Dual-Collateral Model",
                        description: "Yala’s Peg Stability Module (PSM) and overcollateralized CDP system create a dual-collateral model, supporting both BTC and stablecoins for enhanced resilience. With deep integrations in DeFi, Yala offers fast, low-cost transactions and access to a growing multi-chain ecosystem.",
                        bottomDescription: "",
                        image: null
                    },
                ],
                question: {
                    question: "What is Yala mainly used for?",
                    options: [
                        { id: 0, text: 'A centralized exchange', isCorrect: false },
                        { id: 1, text: 'A decentralized stablecoin protocol', isCorrect: true },
                        { id: 2, text: 'A hardware wallet', isCorrect: false },
                        { id: 3, text: 'A mining protocol', isCorrect: false },
                    ],
                }
            },
        ]
    },
    {
        id: 9,
        title: 'Unit Network',
        participants: '12,000',
        description: 'Layer 1 platform for creating and managing community-driven tokens and decentralized economies.',
        reward: 200,
        image_icon: require('../assets/trophy/trophy_unit.png'),
        category: 'project',
        sections: [
            {
                id: '9-1',
                title: 'What is Unit Network?',
                description: 'In this course, you’ll get an introduction to Unit Network and how it’s building a fairer and more inclusive token economy!',
                image: require('../assets/trophy/project/yala.webp'),
                points: 60,
                enrolled: 12000,
                pages: [
                    {
                        title: "What is Unit Network?",
                        description: "Unit Network is a Layer 1 blockchain and platform designed to power the creation, management, and exchange of community-driven tokens. It enables individuals, businesses, and communities to tokenize real-world assets, launch their own tokens, and participate in a transparent and decentralized economy. Users can earn rewards, access decentralized financial services, and contribute to building sustainable economic ecosystems.",
                        bottomDescription: "",
                        image: null
                    },
                    {
                        title: "UNIT Token & Ecosystem",
                        description: "With its UNIT token at the core, Unit Network provides tools for liquidity pooling, decentralized lending, and cross-community collaboration. Its mission is to democratize finance by making tokenization accessible to everyone while ensuring security, efficiency, and long-term sustainability.",
                        bottomDescription: "",
                        image: null
                    },
                ],
                question: {
                    question: "What is Unit Network mainly used for?",
                    options: [
                        { id: 0, text: 'A centralized exchange', isCorrect: false },
                        { id: 1, text: 'A Layer 1 blockchain for community-driven token economies', isCorrect: true },
                        { id: 2, text: 'A hardware wallet', isCorrect: false },
                        { id: 3, text: 'A mining protocol', isCorrect: false },
                    ],
                }
            },
        ]
    },
    {
        id: 10,
        title: 'Espresso',
        participants: '12,000',
        description: 'A base layer for rollups, enabling fast finality, cross-chain composability, and Ethereum compatibility.',
        reward: 200,
        image_icon: require('../assets/trophy/trophy_espresso.png'),
        category: 'project',
        sections: [
            {
                id: '10-1',
                title: 'What is Espresso?',
                description: 'In this course, you’ll get an introduction to Espresso and how it works in the blockchain scalability and data availability space!',
                image: require('../assets/trophy/project/espresso.webp'),
                points: 60,
                enrolled: 12000,
                pages: [
                    {
                        title: "What is Espresso?",
                        description: "Espresso is a modular blockchain infrastructure focused on scalable data availability (DA) for rollups and decentralized applications. It enables developers to offload data storage to a high-throughput DA layer while maintaining security and decentralization. Users and projects benefit from faster transaction confirmation, lower costs, and improved scalability without compromising trust.",
                        bottomDescription: "",
                        image: null
                    },
                    {
                        title: "HotShot Consensus",
                        description: "With its HotShot consensus and advanced DA architecture, Espresso delivers high bandwidth, rapid finality, and robust data integrity. This makes it an ideal foundation for rollups, DeFi protocols, and next-generation Web3 applications that require reliable and scalable data availability.",
                        bottomDescription: "",
                        image: null
                    },
                ],
                question: {
                    question: "What is Espresso mainly used for?",
                    options: [
                        { id: 0, text: 'A centralized exchange', isCorrect: false },
                        { id: 1, text: 'A modular data availability layer', isCorrect: true },
                        { id: 2, text: 'A hardware wallet', isCorrect: false },
                        { id: 3, text: 'A mining protocol', isCorrect: false },
                    ],
                }
            },
        ]
    },
    
];
