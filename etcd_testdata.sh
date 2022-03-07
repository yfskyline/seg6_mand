#!/bin/sh
etcdctl put “/prefixes/2001:db8:1234::_64” ”[{“sid”: “2001:200:1111:ffff::1”},{“sid”: “2001:200:1111:ffff::2”}]”
etcdctl put “/prefixes/2001:db8:4321::_64” ”[{“sid”: “2001:200:1111:ffff::1”},{“sid”: “2001:200:1111:ffff::2”},{“sid”: “2001:200:1111:ffff::3”},{“sid”: “2001:200:1111:ffff::4”}]”
