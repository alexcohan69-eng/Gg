/**
 * Static content backing the /telegram-commands docs page. Kept in
 * sync with lib/telegram/commands.ts's `dispatch()` switch and
 * usertgbot.md's command table.
 */

export type CommandDoc = {
  command: string
  description: string
  example: string
}

export type CommandGroup = {
  id: string
  title: string
  description: string
  commands: CommandDoc[]
}

export const TELEGRAM_COMMAND_GROUPS: CommandGroup[] = [
  {
    id: "account",
    title: "Account",
    description: "Manage the link between your Web Banai account and this bot.",
    commands: [
      { command: "/whoami", description: "Shows which account this bot is linked to.", example: "/whoami" },
      { command: "/unlink", description: "Disconnects this bot from your account.", example: "/unlink" },
      { command: "/help", description: "Lists every available command.", example: "/help" },
    ],
  },
  {
    id: "profile",
    title: "Profile",
    description: "View and update profile information.",
    commands: [
      { command: "/me", description: "Your own profile summary.", example: "/me" },
      { command: "/profile <username>", description: "View another user's profile.", example: "/profile amelia" },
      { command: "/bio <text>", description: "Updates your bio (160 characters max).", example: "/bio Product designer. Building in public." },
    ],
  },
  {
    id: "posts",
    title: "Posts",
    description: "Publish, read, and manage posts.",
    commands: [
      { command: "/post <text>", description: "Publishes a new top-level post.", example: "/post Shipping something new today." },
      { command: "/delete <postId>", description: "Deletes one of your own posts.", example: "/delete 3f9a1c2e-..." },
      { command: "/feed", description: "Shows the latest posts in your feed.", example: "/feed" },
      { command: "/view <postId>", description: "Shows a post and its most recent replies.", example: "/view 3f9a1c2e-..." },
    ],
  },
  {
    id: "engagement",
    title: "Engagement",
    description: "Like, repost, and bookmark posts.",
    commands: [
      { command: "/like <postId>", description: "Likes a post.", example: "/like 3f9a1c2e-..." },
      { command: "/unlike <postId>", description: "Removes your like.", example: "/unlike 3f9a1c2e-..." },
      { command: "/repost <postId>", description: "Reposts a post.", example: "/repost 3f9a1c2e-..." },
      { command: "/unrepost <postId>", description: "Undoes a repost.", example: "/unrepost 3f9a1c2e-..." },
      { command: "/bookmark <postId>", description: "Bookmarks a post.", example: "/bookmark 3f9a1c2e-..." },
      { command: "/unbookmark <postId>", description: "Removes a bookmark.", example: "/unbookmark 3f9a1c2e-..." },
      { command: "/bookmarks", description: "Lists your bookmarked posts.", example: "/bookmarks" },
    ],
  },
  {
    id: "social",
    title: "Social graph",
    description: "Follow, unfollow, and browse followers.",
    commands: [
      { command: "/follow <username>", description: "Follows a user.", example: "/follow amelia" },
      { command: "/unfollow <username>", description: "Unfollows a user.", example: "/unfollow amelia" },
      { command: "/followers [username]", description: "Lists a user's followers (yours if omitted).", example: "/followers amelia" },
      { command: "/following [username]", description: "Lists who a user follows (yours if omitted).", example: "/following amelia" },
    ],
  },
  {
    id: "notifications-search",
    title: "Notifications & search",
    description: "Catch up and find things.",
    commands: [
      { command: "/notifications", description: "Shows your latest notifications.", example: "/notifications" },
      { command: "/search <query>", description: "Searches users and posts.", example: "/search design" },
    ],
  },
  {
    id: "showcase",
    title: "Services, portfolio & testimonials",
    description:
      "List, view, and delete your showcase content. Creating or editing these is rich content, so those actions reply with a link back to the site instead of accepting raw text.",
    commands: [
      { command: "/services [username]", description: "Lists service listings.", example: "/services" },
      { command: "/service <id>", description: "Shows a service listing.", example: "/service 3f9a1c2e" },
      { command: "/delete-service <id>", description: "Deletes one of your services.", example: "/delete-service 3f9a1c2e" },
      { command: "/portfolio [username]", description: "Lists portfolio projects.", example: "/portfolio" },
      { command: "/project <id>", description: "Shows a portfolio project.", example: "/project 3f9a1c2e" },
      { command: "/delete-project <id>", description: "Deletes one of your projects.", example: "/delete-project 3f9a1c2e" },
      { command: "/testimonials [username]", description: "Lists testimonials.", example: "/testimonials" },
      { command: "/testimonial <id>", description: "Shows a testimonial.", example: "/testimonial 3f9a1c2e" },
      { command: "/delete-testimonial <id>", description: "Deletes one of your testimonials.", example: "/delete-testimonial 3f9a1c2e" },
    ],
  },
  {
    id: "messages",
    title: "Direct messages",
    description: "Full two-way messaging, right from Telegram.",
    commands: [
      { command: "/inbox", description: "Lists your conversations with unread counts.", example: "/inbox" },
      { command: "/dm <username> <message>", description: "Sends a direct message.", example: "/dm amelia Loved your latest project!" },
      {
        command: "(plain text)",
        description: "After a DM notification (or /dm), just type normally to reply in that conversation.",
        example: "Thanks, means a lot!",
      },
    ],
  },
]
