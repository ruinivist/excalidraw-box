# a list of architectural decisions

( to remind me when I over-engineer and be fickle minded )

## Image is NOT meant to be exposed directly to the internet

- the defaults MUST take care of this
- and hence AUTH won't be a part of the image, whatever the user is using for reverse proxy should handle auth.
