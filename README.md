# osu! Beatmap Atlas

A work-in-progress interactive atlas of osu! beatmaps.  Plots relationships between maps, visualizes patterns and trends in osu! play over time, and helps visualize your own hiscores and playstyle compared to the universe of osu!.

![A screenshot of a Python notebook showing a 2D projection of an embedding of osu beatmaps rendered with Emblaze.  It has many different circles of varying colors plotted - corresponding to the average PP received for that map in hiscores - and the song IDs and those of neighbors shown on the right for a selected circle.](https://i.ameo.link/c3z.png)

As I write this, it's still early days for the project and most of it is yet to be built.  The majority of what's here now is Python notebooks used for data extraction, pre-processing, and experiments with generating + visualizing embeddings.  You can find more info in the README in the `notebooks/` subdirectory.

I've only done this with osu! standard plays for now, but there's nothing stopping this working for the other modes except the fact that there's less data available for those.

_I'd love to work with people on this who are interested, and I'm also happy to share all the data and process I used here if anyone has similar projects or ideas.  The best way would be to get in touch with me on Discord @ameo; I'd be happy to chat!_

## Overview

I've created similar projects like this for [Spotify artists](https://galaxy.spotifytrack.net/) and [anime](https://anime.ameo.dev/pymde_4d_40n), and I figured that it'd be very cool (probably even cooler tbh) to do it for osu! as well.  The data is rich, has many categorial properties, and the tool could be of actual use to people rather than just a curiosity.

Hiscore data collected over several years from [osu!track](https://ameobea.me/osutrack/) is used as the data source for this project.  Using that, an embedding is produced which places similar beatmaps close to each other.  Check out `notebooks/README` for more technical details on that.
