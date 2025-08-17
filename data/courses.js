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
      image: require('../assets/trophie_placeholder.png'),
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
        image_icon: require('../assets/trophie_book.png'),
        length: 7,
        category: 'coineasy',
        sections: [
            {
                id: '1-1',
                title: 'What is Ethereum?',
                description: 'In this course, you will learn what a crypto wallet is, why you need one, and the different types that exist.',
                image: require('../assets/trophy/coineasy_ethereum.webp'),
                total: 3,
                points: 60,
                enrolled: 12000,
                pages: [
                    {
                        title: "Beyond Digital Money",
                        description: "Ethereum is a blockchain launched in 2015 that not only supports digital money but also allows developers to build apps and programs directly on the network.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy_ethereum_page1.webp')
                    },
                    {
                        title: "Smart Contracts",
                        description: "It introduced smart contracts, which are programs that automatically run when certain conditions are met, enabling services like DeFi and NFTs.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy_ethereum_page2.webp')
                    },
                    {
                        title: "The Currency",
                        description: "Ethereum’s native cryptocurrency is called Ether (ETH), and it is used to pay for transactions, run apps, and interact with smart contracts on the network.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy_ethereum_page3.webp')
                    },
                ],
                question: {
                    title: "Quiz title",
                    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ultrices, magna vitae eleifend placerat, turpis lectus maximus libero,",
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
                id: '1-2',
                title: 'Who is Satoshi Nakamoto?',
                description: 'In this course, you will learn about the mysterious creator of Bitcoin and the impact they left on the world.',
                image: require('../assets/trophy/coineasy_satoshi.webp'),
                total: 3,
                points: 60,
                enrolled: 12000,
                pages: [
                    {
                        title: "The Creator",
                        description: "Satoshi Nakamoto is the anonymous person or group who created Bitcoin and published its whitepaper in 2008.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy_satoshi_page1.webp')
                    },
                    {
                        title: "The Disappearance",
                        description: "After launching Bitcoin in 2009 and communicating with early developers, Satoshi stopped all public activity in 2011 and has never been heard from again.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy_satoshi_page2.webp')
                    },
                    {
                        title: "The Mystery",
                        description: "No one knows Satoshi’s true identity, and their Bitcoin wallet — holding over 1 million BTC — has never been moved, adding to the mystery.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy_satoshi_page3.webp')
                    },
                ],
                question: {
                    title: "Quiz title",
                    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ultrices, magna vitae eleifend placerat, turpis lectus maximus libero,",
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
                id: '1-3',
                title: 'What is Bitcoin?',
                description: 'In this course, you will learn what Bitcoin is, how it works, and why it is important.',
                image: require('../assets/trophy/coineasy_bitcoin.webp'),
                total: 3,
                points: 60,
                enrolled: 12000,
                pages: [
                    {
                        title: "The First Cryptocurrency",
                        description: "Bitcoin is the first cryptocurrency, created in 2009 to let people send money directly to each other without banks, and in 2010 it was famously used to buy two pizzas for 10,000 BTC — the first real-world Bitcoin purchase.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy_bitcoin_page1.webp')
                    },
                    {
                        title: "How It Works",
                        description: "Bitcoin transactions are recorded on a public blockchain and verified by a network of computers through a process called mining.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy_bitcoin_page2.webp')
                    },
                    {
                        title: "Limited Supply",
                        description: "Only 21 million Bitcoins will ever exist, which makes it scarce and one reason why people see it as valuable.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy_bitcoin_page3.webp')
                    },
                ],
                question: {
                    title: "Quiz title",
                    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ultrices, magna vitae eleifend placerat, turpis lectus maximus libero,",
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
                id: '1-4',
                title: 'What is Cryptocurrency?',
                description: 'In this course, you will learn what cryptocurrency is and why people use it as digital money.',
                image: require('../assets/trophy/coineasy_crypto.webp'),
                total: 3,
                points: 60,
                enrolled: 12000,
                pages: [
                    {
                        title: "Digital Money",
                        description: "Cryptocurrency is a type of digital money that exists only online and uses blockchain technology to record and secure transactions.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy_crypto_page1.webp')
                    },
                    {
                        title: "No Middleman",
                        description: "It allows people to send and receive payments directly to each other without needing a bank or payment company in the middle.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy_crypto_page2.webp')
                    },
                    {
                        title: "Many Types",
                        description: "There are thousands of different cryptocurrencies, with popular examples including Bitcoin, Ethereum, and Dogecoin.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy_crypto_page3.webp')
                    },
                ],
                question: {
                    title: "Quiz title",
                    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ultrices, magna vitae eleifend placerat, turpis lectus maximus libero,",
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
                title: 'Types of Blockchains',
                description: 'In this course, you’ll explore the different types of blockchains and their real-world uses.',
                image: require('../assets/trophy/coineasy_blockchain.webp'),
                total: 3,
                points: 60,
                enrolled: 12000,
                pages: [
                    {
                        title: "Public Blockchains",
                        description: "A public blockchain is an open network where anyone can join without restrictions, verify transactions, and view the entire history publicly, making it fully decentralized; examples include Bitcoin and Ethereum.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy_blockchain_page1.webp')
                    },
                    {
                        title: "Private Blockchains",
                        description: "A private blockchain is a closed network where only authorized individuals or organizations can join, often controlled by a single entity and used for business operations that require privacy, such as Corda or Ripple.",
                        bottomDescription: "",
                        image: null
                    },
                    {
                        title: "Hybrid & Consortium",
                        description: "A consortium blockchain is a hybrid that combines features of public and private blockchains, managed by a group of organizations that share data while limiting access to approved participants, with examples like Hyperledger.",
                        bottomDescription: "",
                        image: null
                    },
                ],
                question: {
                    title: "Quiz title",
                    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ultrices, magna vitae eleifend placerat, turpis lectus maximus libero,",
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
                id: '1-6',
                title: 'How Does Blockchain Work?',
                description: 'In this course, you will learn how blockchain records, links, and secures information.',
                image: require('../assets/trophy/coineasy_work.webp'),
                total: 3,
                points: 60,
                enrolled: 12000,
                pages: [
                    {
                        title: "Blocks and Transactions",
                        description: "A blockchain stores information in digital blocks, each containing transaction details, a time stamp, and a unique code called a hash.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy_work_page1.webp')
                    },
                    {
                        title: "Linking Blocks",
                        description: "Each new block includes the hash of the previous block, creating a chain that makes it easy to detect and prevent tampering.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy_work_page2.webp')
                    },
                    {
                        title: "Consensus Mechanisms",
                        description: "Before a block is added, many computers on the network check and agree that the information is correct, using a process called consensus.",
                        bottomDescription: "",
                        image: null
                    },
                ],
                question: {
                    title: "Quiz title",
                    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ultrices, magna vitae eleifend placerat, turpis lectus maximus libero,",
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
                id: '1-7',
                title: 'What is Blockchain?',
                description: 'In this course, you’ll get an introduction to blockchain technology and why it’s transforming the world.',
                image: require('../assets/trophy/coineasy_what.webp'),
                total: 2,
                points: 60,
                enrolled: 12000,
                pages: [
                    {
                        title: "Understanding Blockchain",
                        description: "Blockchain is a type of database that stores information in blocks linked together in a chain. Once data is recorded, it’s extremely difficult to change — making it secure and transparent.",
                        bottomDescription: "",
                        image: require('../assets/trophy/coineasy_what_page1.webp')
                    },
                    {
                        title: "Why Blockchain Matters",
                        description: "Because it’s decentralized, no single person or company controls it. Anyone can participate, verify transactions, and trust the system without relying on a middleman.",
                        bottomDescription: "",
                        image: null
                    },
                ],
                question: {
                    title: "Quiz title",
                    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ultrices, magna vitae eleifend placerat, turpis lectus maximus libero,",
                    question: "Blockchain is best described as:",
                    options: [
                        { id: 0, text: 'A type of social media', isCorrect: false },
                        { id: 1, text: 'A decentralized digital ledger', isCorrect: true },
                        { id: 2, text: 'A centralized database', isCorrect: false },
                        { id: 3, text: 'A type of cryptocurrency', isCorrect: false },
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
        image_icon: require('../assets/trophie_orange.png'),
        length: 6,
        category: 'coineasy',
        sections: [
            {
                id: '2-1',
                title: 'What is 1inch?',
                description: 'In this course, you will learn everything you need to know about 1inch!',
                image: require('../assets/trophie_ninja_bg_image.png'),
                total: 14,
                points: 60,
                enrolled: 12000,
                pages: Array.from({ length: 14 }, () => ({ ...courseObject })),
                question: {
                    title: "Quiz title",
                    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ultrices, magna vitae eleifend placerat, turpis lectus maximus libero,",
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
                image: require('../assets/trophie_ninja_bg_image.png'),
                total: 14,
                points: 60,
                enrolled: 12000,
                pages: Array.from({ length: 14 }, () => ({ ...courseObject })),
                question: {
                    title: "Quiz title",
                    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ultrices, magna vitae eleifend placerat, turpis lectus maximus libero,",
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
                image: require('../assets/trophie_ninja_bg_image.png'),
                total: 14,
                points: 60,
                enrolled: 12000,
                pages: Array.from({ length: 14 }, () => ({ ...courseObject })),
                question: {
                    title: "Quiz title",
                    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ultrices, magna vitae eleifend placerat, turpis lectus maximus libero,",
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
                image: require('../assets/trophie_ninja_bg_image.png'),
                total: 14,
                points: 60,
                enrolled: 12000,
                pages: Array.from({ length: 14 }, () => ({ ...courseObject })),
                question: {
                    title: "Quiz title",
                    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ultrices, magna vitae eleifend placerat, turpis lectus maximus libero,",
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
        image_icon: require('../assets/trophie_education.png'),
        length: 6,
        category: 'coineasy',
        sections: [
            {
                id: '3-1',
                title: 'What is 1inch?',
                description: 'In this course, you will learn everything you need to know about 1inch!',
                image: require('../assets/trophie_ninja_bg_image.png'),
                total: 14,
                points: 60,
                enrolled: 12000,
                pages: Array.from({ length: 14 }, () => ({ ...courseObject })),
                question: {
                    title: "Quiz title",
                    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ultrices, magna vitae eleifend placerat, turpis lectus maximus libero,",
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
                image: require('../assets/trophie_ninja_bg_image.png'),
                total: 14,
                points: 60,
                enrolled: 12000,
                pages: Array.from({ length: 14 }, () => ({ ...courseObject })),
                question: {
                    title: "Quiz title",
                    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ultrices, magna vitae eleifend placerat, turpis lectus maximus libero,",
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
                image: require('../assets/trophie_ninja_bg_image.png'),
                total: 14,
                points: 60,
                enrolled: 12000,
                pages: Array.from({ length: 14 }, () => ({ ...courseObject })),
                question: {
                    title: "Quiz title",
                    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ultrices, magna vitae eleifend placerat, turpis lectus maximus libero,",
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
                image: require('../assets/trophie_ninja_bg_image.png'),
                total: 14,
                points: 60,
                enrolled: 12000,
                pages: Array.from({ length: 14 }, () => ({ ...courseObject })),
                question: {
                    title: "Quiz title",
                    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ultrices, magna vitae eleifend placerat, turpis lectus maximus libero,",
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
        title: 'Basic',
        participants: '12,000',
        description: 'VANA is a decentralized AI data network',
        reward: 200,
        image_icon: require('../assets/trophie_vana.png'),
        length: 6,
        category: 'project',
        sections: [
            {
                id: '4-1',
                title: 'What is 1inch?',
                description: 'In this course, you will learn everything you need to know about 1inch!',
                image: require('../assets/trophie_ninja_bg_image.png'),
                total: 14,
                points: 60,
                enrolled: 12000,
                pages: Array.from({ length: 14 }, () => ({ ...courseObject })),
                question: {
                    title: "Quiz title",
                    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ultrices, magna vitae eleifend placerat, turpis lectus maximus libero,",
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
                id: '4-2',
                title: 'What is 1inch?',
                description: 'In this course, you will learn everything you need to know about 1inch!',
                image: require('../assets/trophie_ninja_bg_image.png'),
                total: 14,
                points: 60,
                enrolled: 12000,
                pages: Array.from({ length: 14 }, () => ({ ...courseObject })),
                question: {
                    title: "Quiz title",
                    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ultrices, magna vitae eleifend placerat, turpis lectus maximus libero,",
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
                id: '4-3',
                title: 'What is 1inch?',
                description: 'In this course, you will learn everything you need to know about 1inch!',
                image: require('../assets/trophie_ninja_bg_image.png'),
                total: 14,
                points: 60,
                enrolled: 12000,
                pages: Array.from({ length: 14 }, () => ({ ...courseObject })),
                question: {
                    title: "Quiz title",
                    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ultrices, magna vitae eleifend placerat, turpis lectus maximus libero,",
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
                id: '4-4',
                title: 'What is 1inch?',
                description: 'In this course, you will learn everything you need to know about 1inch!',
                image: require('../assets/trophie_ninja_bg_image.png'),
                total: 14,
                points: 60,
                enrolled: 12000,
                pages: Array.from({ length: 14 }, () => ({ ...courseObject })),
                question: {
                    title: "Quiz title",
                    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ultrices, magna vitae eleifend placerat, turpis lectus maximus libero,",
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
        id: 5,
        title: '1inch',
        participants: '12,000',
        description: '1inch is a DeFi aggregator finding the best prices across multiple liquidity sources',
        reward: 200,
        image_icon: require('../assets/trophie_1inch.png'),
        length: 6,
        category: 'project',
        sections: [
            {
                id: '5-1',
                title: 'What is 1inch?',
                description: 'In this course, you will learn everything you need to know about 1inch!',
                image: require('../assets/trophie_ninja_bg_image.png'),
                total: 14,
                points: 60,
                enrolled: 12000,
                pages: Array.from({ length: 14 }, () => ({ ...courseObject })),
                question: {
                    title: "Quiz title",
                    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ultrices, magna vitae eleifend placerat, turpis lectus maximus libero,",
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
                id: '5-2',
                title: 'What is 1inch?',
                description: 'In this course, you will learn everything you need to know about 1inch!',
                image: require('../assets/trophie_ninja_bg_image.png'),
                total: 14,
                points: 60,
                enrolled: 12000,
                pages: Array.from({ length: 14 }, () => ({ ...courseObject })),
                question: {
                    title: "Quiz title",
                    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ultrices, magna vitae eleifend placerat, turpis lectus maximus libero,",
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
                id: '5-3',
                title: 'What is 1inch?',
                description: 'In this course, you will learn everything you need to know about 1inch!',
                image: require('../assets/trophie_ninja_bg_image.png'),
                total: 14,
                points: 60,
                enrolled: 12000,
                pages: Array.from({ length: 14 }, () => ({ ...courseObject })),
                question: {
                    title: "Quiz title",
                    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ultrices, magna vitae eleifend placerat, turpis lectus maximus libero,",
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
                id: '5-4',
                title: 'What is 1inch?',
                description: 'In this course, you will learn everything you need to know about 1inch!',
                image: require('../assets/trophie_ninja_bg_image.png'),
                total: 14,
                points: 60,
                enrolled: 12000,
                pages: Array.from({ length: 14 }, () => ({ ...courseObject })),
                question: {
                    title: "Quiz title",
                    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ultrices, magna vitae eleifend placerat, turpis lectus maximus libero,",
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
        id: 6,
        title: 'Notcoin',
        participants: '12,000',
        description: 'Notcoin is a viral tap-to-earn GameFi project on Telegram',
        reward: 200,
        image_icon: require('../assets/trophie_notcoin.png'),
        length: 6,
        category: 'project',
        sections: [
            {
                id: '6-1',
                title: 'What is 1inch?',
                description: 'In this course, you will learn everything you need to know about 1inch!',
                image: require('../assets/trophie_ninja_bg_image.png'),
                total: 14,
                points: 60,
                enrolled: 12000,
                pages: Array.from({ length: 14 }, () => ({ ...courseObject })),
                question: {
                    title: "Quiz title",
                    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ultrices, magna vitae eleifend placerat, turpis lectus maximus libero,",
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
                id: '6-2',
                title: 'What is 1inch?',
                description: 'In this course, you will learn everything you need to know about 1inch!',
                image: require('../assets/trophie_ninja_bg_image.png'),
                total: 14,
                points: 60,
                enrolled: 12000,
                pages: Array.from({ length: 14 }, () => ({ ...courseObject })),
                question: {
                    title: "Quiz title",
                    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ultrices, magna vitae eleifend placerat, turpis lectus maximus libero,",
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
                id: '6-3',
                title: 'What is 1inch?',
                description: 'In this course, you will learn everything you need to know about 1inch!',
                image: require('../assets/trophie_ninja_bg_image.png'),
                total: 14,
                points: 60,
                enrolled: 12000,
                pages: Array.from({ length: 14 }, () => ({ ...courseObject })),
                question: {
                    title: "Quiz title",
                    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ultrices, magna vitae eleifend placerat, turpis lectus maximus libero,",
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
                id: '6-4',
                title: 'What is 1inch?',
                description: 'In this course, you will learn everything you need to know about 1inch!',
                image: require('../assets/trophie_ninja_bg_image.png'),
                total: 14,
                points: 60,
                enrolled: 12000,
                pages: Array.from({ length: 14 }, () => ({ ...courseObject })),
                question: {
                    title: "Quiz title",
                    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam ultrices, magna vitae eleifend placerat, turpis lectus maximus libero,",
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
    }
];
