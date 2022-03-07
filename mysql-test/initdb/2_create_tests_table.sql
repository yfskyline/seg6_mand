CREATE TABLE IF NOT EXISTS `rtt_db`.`prefix_sid_rtt` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `src` varchar(39),
  `dest_prefix` varchar(43),
  `sid` varchar(39),
  `rtt` int(32) unsigned,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;
