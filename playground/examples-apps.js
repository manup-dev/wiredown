// The showcase, part two: a chat app, a social feed and a booking app (Lucide icons).
// Plain strings: the page runs unbuilt, so no file reads.

const CHAT_APP = `@device 390x680 fit
@look clean
@title "Chat app"
@motion slide
@flow inbox thread inbox new
screen inbox "Inbox"
  navbar "Messages"
  stack pad=16 gap=12
    row gap=8
      input "Search messages" type=search placeholder="Search" w=fill
      button "New" primary icon=plus -> new
    list
      item "Ada Lovelace" "Photos from the trip are up" icon=user -> thread
      item "Design team" "Grace: the new icons look great" icon=users
      item "Alan Turing" "Can we move lunch to 1?" icon=user
      item "Katherine Johnson" "Launch window moved to 9:05" icon=user
      item "Billing" "Your receipt for November" icon=mail muted
  tabbar
    item "Chats" icon=message-circle selected
    item "Calls" icon=clock
    item "Settings" icon=settings

screen thread "Ada Lovelace"
  navbar "Ada Lovelace" back -> inbox
  stack pad=16 gap=12
    row gap=8
      avatar "Ada Lovelace"
      card
        text "We are back! Photos from the trip are up."
    row gap=8
      avatar "Ada Lovelace"
      image "Beach at sunset" type=photo ratio=4:3 w=220
    row justify=end
      card w=hug
        text "Lovely! The boat one?"
    row gap=8
      avatar "Ada Lovelace"
      card
        text "Sending it now."
    spacer
    row gap=8
      input "Message" placeholder="Write a message" w=fill
      button "Send" primary

screen new "New message" motion=sheet
  navbar "Messages"
  stack pad=16 gap=12
    input "Search messages" type=search placeholder="Search"
    list
      item "Ada Lovelace" "Sending it now." icon=user
      item "Design team" "Grace: the new icons look great" icon=users
  sheet "New message"
    input "To" placeholder="Name or email"
    list
      item "Grace Hopper" "Online" icon=user -> thread
      item "Katherine Johnson" "Last seen today" icon=user
    textarea "Message" rows=3 placeholder="Say hello"
    button "Send" primary w=fill -> inbox`;

const SOCIAL_FEED = `@device phone fit
@look clean
@title "Social feed"
@motion fade
screen feed "Feed"
  navbar "Home"
  stack pad=16 gap=12
    card -> post
      row gap=8
        avatar "Ada Lovelace"
        stack gap=0 grow=1
          h3 "Ada Lovelace"
          text "Lisbon · 2 h" muted
        icon "more"
      image "Tram on a hill street" type=photo ratio=16:9
      row gap=14
        icon "heart"
        icon "message-circle"
        spacer
        text "128 likes" muted
    card
      row gap=8
        avatar "Grace Hopper"
        h3 "Grace Hopper"
      image "Making pasta, a 30 second clip" type=video ratio=21:9
  tabbar
    item "Home" icon=home selected
    item "Search" icon=search
    item "Post" icon=plus
    item "Activity" icon=heart
    item "Profile" icon=user

screen post "Post"
  navbar "Post" back -> feed
  stack pad=16 gap=12
    row gap=8 -> profile
      avatar "Ada Lovelace"
      stack gap=0 grow=1
        h3 "Ada Lovelace"
        text "Lisbon · 2 h" muted
      button "Follow" primary
    image "Tram on a hill street" type=photo ratio=4:3
    text "The 28 tram, the steepest ride in town."
    divider
    list
      item "Grace Hopper" "Took the same one last spring!" icon=user
      item "Alan Turing" "Which stop is this?" icon=user
    input "Add a comment" placeholder="Write a comment"

screen profile "Profile" motion=zoom
  navbar "Ada Lovelace" back -> post
  stack pad=16 gap=12 align=center
    avatar "Ada Lovelace" w=88 h=88
    h2 "Ada Lovelace"
    text "Travel notes and too many trams." muted
    grid cols=3 gap=8
      stack gap=0 align=center
        h3 "214"
        text "Posts" muted
      stack gap=0 align=center
        h3 "1.2k"
        text "Followers" muted
      stack gap=0 align=center
        h3 "180"
        text "Following" muted
    button "Follow" primary w=fill
    grid cols=3 gap=4
      image "Photo" type=photo ratio=1:1
      image "Photo" type=photo ratio=1:1
      image "Clip" type=video ratio=1:1
      image "Photo" type=photo ratio=1:1
      image "Photo" type=photo ratio=1:1
      image "Photo" type=photo ratio=1:1
  tabbar
    item "Home" icon=home -> feed
    item "Search" icon=search
    item "Post" icon=plus
    item "Activity" icon=heart
    item "Profile" icon=user selected`;

const BOOKING_APP = `@device 390x720 fit
@look clean
@title "Booking app"
@icons lucide
@motion push
screen search "Search"
  navbar "Find a stay"
  stack pad=16 gap=12
    input "Where to?" type=search placeholder="Lisbon, Portugal"
    row gap=8
      button "12 to 15 Dec" icon=calendar-days w=fill
      button "2 guests" icon=users w=fill
    image "Map of central Lisbon" type=map ratio=4:3
    button "Show 128 stays" primary w=fill icon=search -> results
  tabbar
    item "Explore" icon=search selected
    item "Saved" icon=heart
    item "Trips" icon=plane
    item "Profile" icon=user

screen results "Results"
  navbar "128 stays in Lisbon" back -> search
  stack pad=16 gap=12
    row gap=8
      badge "Under $150" icon=wallet
      badge "Free cancel" icon=check
      badge "Wifi" icon=wifi
    card -> detail
      image "Bright flat in Alfama" type=photo ratio=16:9
      row justify=between
        h3 "Bright flat in Alfama"
        badge "4.9" icon=star tone=good
      text "$132 a night · 1.2 km from the centre" muted
    card
      image "Loft near the river" type=photo ratio=16:9
      row justify=between
        h3 "Loft near the river"
        badge "4.7" icon=star tone=good
      text "$118 a night · 2.0 km from the centre" muted

screen detail "Bright flat in Alfama"
  navbar "Alfama" back -> results
  stack pad=16 gap=12
    image "Living room with a view" type=photo ratio=16:9
    h2 "Bright flat in Alfama"
    row gap=6
      icon "map-pin"
      text "Alfama, Lisbon" muted
    row gap=8
      badge "2 beds" icon=bed-double
      badge "Wifi" icon=wifi
      badge "Breakfast" icon=coffee
    text "A sunny top floor flat with a view over the river, five minutes from the tram."
    row gap=10
      avatar "Marta Silva"
      stack gap=0 grow=1
        h3 "Hosted by Marta"
        text "Replies within an hour" muted
    row justify=between align=center
      stack gap=0
        h3 "$396"
        text "3 nights" muted
      button "Reserve" primary -> confirm

screen confirm "Confirm" motion=sheet
  navbar "Alfama" back -> detail
  sheet "Confirm your stay"
    row justify=between
      text "12 to 15 Dec · 2 guests"
      link "Edit" -> search
    row justify=between
      text "3 nights x $132"
      text "$396"
    row justify=between
      text "Cleaning"
      text "$25"
    divider
    row justify=between
      h3 "Total"
      h3 "$421"
    button "Confirm and pay" primary w=fill icon=credit-card -> booked

screen booked "Booked" motion=zoom
  stack pad=24 gap=16 align=center
    icon "party-popper"
    h1 "You are going to Lisbon" align=center
    text "Your host will send the check in details a day before you arrive." align=center muted
    card w=fill
      row gap=10
        icon "calendar-days"
        stack gap=0 grow=1
          h3 "12 to 15 Dec"
          text "Check in from 3 pm" muted
      row gap=10
        icon "map-pin"
        stack gap=0 grow=1
          h3 "Bright flat in Alfama"
          text "Rua de São Miguel 14" muted
    button "View trip" primary w=fill icon=plane
    link "Back to search" -> search`;

export const SHOWCASE_B = [
  { id: 'chat-app', label: 'Chat app', body: CHAT_APP },
  { id: 'social-feed', label: 'Social feed', body: SOCIAL_FEED },
  { id: 'booking-app', label: 'Booking app', body: BOOKING_APP },
];
