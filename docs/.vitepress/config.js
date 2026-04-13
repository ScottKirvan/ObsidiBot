export default {
  base: '/ObsidiBot/',
  title: 'ObsidiBot',
  description: 'A Claude Code agent inside your Obsidian vault',

  head: [
    ['link', { rel: 'icon', href: '/ObsidiBot/favicon.ico' }],
  ],

  themeConfig: {
    logo: '../assets/media/logo.png',
    siteTitle: 'ObsidiBot',

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Reference', link: '/guide/commands' },
      {
        text: 'Community',
        items: [
          { text: 'GitHub', link: 'https://github.com/ScottKirvan/ObsidiBot' },
          { text: 'Discord', link: 'https://discord.gg/TN6XJSNK5Y' },
          { text: 'Releases', link: 'https://github.com/ScottKirvan/ObsidiBot/releases' },
        ]
      }
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Requirements & Installation', link: '/guide/getting-started' },
          { text: 'First Launch', link: '/guide/first-launch' },
        ]
      },
      {
        text: 'Using ObsidiBot',
        items: [
          { text: 'Chat Panel', link: '/guide/chat-panel' },
          { text: 'Slash Commands', link: '/guide/slash-commands' },
          { text: 'Session Manager', link: '/guide/sessions' },
          { text: 'Context System', link: '/guide/context-system' },
        ]
      },
      {
        text: 'Reference',
        items: [
          { text: 'Commands', link: '/guide/commands' },
          { text: 'Settings', link: '/guide/settings' },
          { text: 'Permissions', link: '/guide/permissions' },
        ]
      },
      {
        text: 'Support',
        items: [
          { text: 'Troubleshooting', link: '/guide/troubleshooting' },
          { text: 'Known Limitations', link: '/guide/troubleshooting#known-limitations' },
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/ScottKirvan/ObsidiBot' },
      { icon: 'discord', link: 'https://discord.gg/TN6XJSNK5Y' },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © Scott Kirvan'
    },

    editLink: {
      pattern: 'https://github.com/ScottKirvan/ObsidiBot/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    },

    search: {
      provider: 'local'
    }
  }
}
