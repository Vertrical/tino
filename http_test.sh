#!/bin/sh

http :8000/api
http :8000/api/genres
http :8000/api/genres/0
http :8000/api/genres/0/1
http :8000/api/laptops
http :8000/api/laptops/123
http :8000/api/laptops/bla
http :8000/api/color
http :8000/api/color/blue
http :8000/api/color/blue/none
http :8000/api/color/none
