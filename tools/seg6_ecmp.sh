#!/bin/bash

ip -6 route del 2001:db8::/64
ip -6 route add 2001:db8::/64 via encap seg6 mode encap segs 1::1 dev ens192


