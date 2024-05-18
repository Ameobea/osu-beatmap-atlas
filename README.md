# osu! Beatmap Atlas

An interactive atlas of osu! beatmaps.  Plots relationships between maps, visualizes patterns and trends in osu! play over time, and helps visualize your own hiscores and playstyle compared to the universe of osu!.

**Try it out: https://osu-atlas.ameo.dev/**

![A screenshot of the osu! map showing a variety of circles representing beatmaps with different mod combinations.  Some of the circles are highlighted to represent those in a user's hiscores.  The circles are colored differently and arranged with varying density and size.  One is selected and info about the selected beatmap is shown at the bottom.  There's a bar on the left with filters and other controls for the visualization.](https://i.ameo.link/c58.jpg)

## Overview

I've created similar projects like this for [Spotify artists](https://galaxy.spotifytrack.net/) and [anime](https://anime.ameo.dev/pymde_4d_40n), and I figured that it'd be very cool (probably even cooler tbh) to do it for osu! as well.  The data is rich, has many categorial properties, and the tool could be of actual use to people rather than just a curiosity.

Hiscore data collected over several years from [osu!track](https://ameobea.me/osutrack/) is used as the data source for this project.  Using that, an embedding is produced which places similar beatmaps close to each other.  Check out `notebooks/README` for more technical details on that.

## How It was Built

All of the data used to create the embedding came from [osu!track](https://ameobea.me/osutrack/). The beatmaps in all tracked users' top plays were used to determine relationships between different maps and construct the embedding.
