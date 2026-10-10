"""Hand-authored node tables and tagging rules for the expanded Ulysses graph.

Everything here is data. `build_graph_data.py` turns it, plus the notes corpus,
into src/data/expansion.json and src/data/corpus.json.

`rx` is a case-insensitive regex, wrapped in word boundaries by the builder.
It decides which Joyce quote blocks a node is tagged on. `eps` lists the
episodes a node is linked to by hand; nodes with no `eps` get theirs derived
from the blocks their regex hits.
"""

PARTS = [
    ("part1", "Part I · The Telemachiad", "Episodes 1–3. Stephen's morning: guilt, poverty, exile.", [1, 2, 3]),
    ("part2", "Part II · The Odyssey", "Episodes 4–15. Bloom's day: wandering, desire, humiliation, Dublin's social world.", list(range(4, 16))),
    ("part3", "Part III · The Nostos", "Episodes 16–18. Return, reconciliation, home.", [16, 17, 18]),
]

# id, label, summary, rx
CHARACTERS = [
    ("zoe", "Zoe Higgins", "Prostitute in Bella Cohen's house. In Circe she talks away at Bloom and Stephen and takes part in the Nighttown scenes.", r"zoe"),
    ("bella", "Bella / Bello Cohen", "Brothel keeper of Nighttown. In Circe she turns into the male Bello and subjects Bloom to the extended humiliation sequence.", r"bella|bello"),
    ("edy", "Edy Boardman", "One of Gerty MacDowell's friends on Sandymount Strand; reappears in Circe's chorus of bawds.", r"edy"),
    ("carr", "Private Carr", "Drunk British soldier who knocks Stephen down at the end of Circe.", r"private carr|carr"),
    ("compton", "Private Compton", "Private Carr's companion in the Nighttown street scene.", r"private compton|compton"),
    ("cunningham", "Martin Cunningham", "The diplomat and helper who rides in the funeral carriage and organises the Dignam subscription.", r"martin cunningham|cunningham"),
    ("power", "Mr Power", "Rides in the Hades carriage with Bloom, Simon Dedalus and Cunningham.", r"mr power|power"),
    ("lenehan", "Lenehan", "Sporting hanger-on and wit. 'La Cloche!' in Sirens; in Circe he shouts 'Plagiarist!' at Bloom.", r"lenehan"),
    ("lynch", "Lynch", "Stephen's medical-student friend in Nighttown.", r"lynch"),
    ("cowley", "Father Cowley", "Priest among the singers at the Ormond bar in Sirens.", r"cowley"),
    ("dollard", "Ben Dollard", "Bass singer whose voice fills the Ormond bar in Sirens.", r"ben dollard|dollard"),
    ("nymph", "The Nymph", "Figure from the picture above Bloom's bed who steps into Circe and accuses him.", r"nymph"),
    ("cissy", "Cissy Caffrey", "Gerty's friend on the strand; a voice in Circe's redcoat scene.", r"cissy caffrey|cissy"),
    ("talboys", "Mrs Talboys", "Dominatrix figure in Bloom's Circe trial fantasy.", r"talboys"),
    ("breen", "Mrs Breen", "Josie Breen, a woman from Bloom's past met in the street.", r"breen"),
    ("lambert", "Ned Lambert", "Dublin acquaintance of the Dignam circle.", r"lambert"),
    ("florry", "Florry Talbot", "Prostitute in Bella Cohen's house.", r"florry"),
    ("dowie", "Alexander J. Christ Dowie", "American evangelist who appears as a mock-prophet in Oxen of the Sun and Circe.", r"dowie"),
    ("ellen", "Ellen Bloom", "Bloom's mother, who appears in Circe.", r"ellen bloom|ellen"),
    ("menton", "John Henry Menton", "Solicitor who slighted Bloom at Dignam's funeral.", r"menton"),
    ("mananaun", "Mananaun MacLir", "Irish sea god who chants in Circe's hallucination, with the gasjet.", r"mananaun"),
    ("sibyl", "The Veiled Sibyl", "Prophetic figure in Circe's crowd scene.", r"sibyl"),
    ("bridie", "Bridie Kelly", "The prostitute from Bloom's youth who appears as a bawd in Circe.", r"bridie"),
    ("virag", "Rudolph Virag", "Bloom's father, who died by suicide. He appears in Circe.", r"virag|rudolph"),
    ("macintosh", "The Man in the Macintosh", "The unidentified mourner Bloom notices at Glasnevin. Never named in the novel.", r"mackintosh|macintosh"),
    ("garryowen", "Garryowen", "The Citizen's dog in Barney Kiernan's pub.", r"garryowen"),
]

# id, label, summary, rx
PLACES = [
    ("davy_byrnes", "Davy Byrne's", "The pub where Bloom eats his cheese sandwich in Lestrygonians.", r"davy byrne"),
    ("newspaper", "The Newspaper Offices", "Aeolus: the newsroom, every section under a mock headline.", r"newspaper|freeman"),
    ("mabbot", "Mabbot Street", "The entrance to Nighttown where Circe opens.", r"mabbot"),
    ("bella_house", "Bella Cohen's House", "The brothel where Circe's central hallucinations are staged.", r"bella cohen|brothel"),
    ("shelter", "The Cabman's Shelter", "Eumaeus: Bloom takes Stephen to recover after Nighttown.", r"cabman|shelter"),
    ("maternity_hospital", "The Maternity Hospital", "Oxen of the Sun: the labour of Mina Purefoy and a style that grows with it.", r"maternity|hospital"),
    ("howth", "Howth Head", "The headland and Bailey light Bloom can see from the strand; memory of Molly.", r"howth|bailey"),
    ("gibraltar", "Gibraltar", "Molly's birthplace; the memory-ground of Penelope.", r"gibraltar"),
    ("paris", "Paris", "Where Stephen met Kevin Egan; the exile city.", r"paris"),
    ("bullock", "Bullock Harbour", "Seen from the Martello tower in the opening episode.", r"bullock"),
    ("stepaside", "Stepaside", "'In darkest Stepaside': Bloom entering Nighttown, pockets checked.", r"stepaside"),
    ("carriage", "The Funeral Carriage", "The closed space in Hades where the Dignam talk, death-thoughts and Boylan sighting happen.", r"carriage|hearse"),
]

# root flag, id, label, parent, summary, rx, eps
THEMES = [
    ("exile", "Exile, Usurpation & Home", None, "Who has the key, who owns the house, who is shut out of it. The tower, Eccles Street, the exile abroad.", r"exile|home|tower|usurp\w*|key|window", [1, 3, 4, 9, 17]),
    ("body", "The Body", None, "Food, bathing, excretion, birth, sex: the body is treated with the same attention as theology.", r"body|flesh|bath|skin|bosom|naked|bladder", [4, 5, 8, 13, 14, 15]),
    ("nation", "Jewishness, Nation & Empire", None, "Bloom as Jew and Irishman; the Citizen's nationalism; the colonizer's curiosity.", r"jews?|jewish|nation\w*|empire|irish|ireland", [2, 12, 15]),
    ("knowledge", "Knowledge & the Unknowable", None, "What can be known about another person, a name, a past. Misreadings and strangers.", r"know\w*|memory|metempsychosis|parallax", [3, 4, 5, 15, 17]),
    ("rudy-days", "Rudy's Eleven Days", "fatherhood", "The son who lived eleven days, eleven years ago. He appears once, in Circe, silently.", r"rudy|eleven", [4, 6, 15, 17]),
    ("telemachus", "The Search for a Father", "fatherhood", "Stephen looking for a father, Bloom for a son; the plot of the novel's second half.", r"father|son", [1, 9, 16, 17]),
    ("simon-failed", "Simon as Failed Father", "fatherhood", "A great voice and a failed man: the anti-Bloom father.", r"simon", [6, 11]),
    ("virag-suicide", "Rudolph's Suicide", "fatherhood", "Bloom's father, dead by poison, behind Bloom's thoughts of death in Hades.", r"virag|rudolph|suicide|poison", [6, 15]),
    ("four-oclock", "The Four O'Clock Appointment", "cuckoldom", "The hour of Boylan's visit to Molly counts down through the day.", r"four o.?clock|4 ?p\.?m|appointment|rendezvous", [4, 10, 11, 18]),
    ("boylan-double", "Boylan as Double & Rival", "cuckoldom", "Boylan as tormentor, mirror and catalyst: the hollow centre Bloom orbits.", r"boylan|blazes", [4, 10, 11, 15, 18]),
    ("masochism", "Masochism & Submission", "cuckoldom", "Bello, the whip, the footstool: Bloom's fantasies of being dominated.", r"masochis\w*|submission|bello|humiliat\w+|slave|footstool", [15]),
    ("equanimity", "Equanimity", "cuckoldom", "Envy, jealousy, abnegation, equanimity: Ithaca's four-stage answer to the appointment.", r"equanim\w*|abnegation|envy|jealous\w*", [17]),
    ("usurpation", "Usurpation & the Key", "exile", "Mulligan takes the key, the tower, the money; Antinous among the suitors.", r"usurp\w*|key|tenant|antinous|suitors?", [1, 9, 17]),
    ("kevin-egan-exile", "The Failed Rebel in Exile", "exile", "Kevin Egan in Paris: a man history forgot, still waiting.", r"egan|exile|fenian|rebel", [3, 8]),
    ("private-public", "Private & Public", "exile", "What is done behind a door and what is done in the street; Bloom's private self against Dublin's public one.", r"private|public", [6, 10, 15]),
    ("commerce", "Advertising & Commerce", "exile", "Bloom the canvasser; the economy of coins, ads and small debts that runs the day.", r"advert\w*|canvass\w*|business|money|wages|eightpence|shilling", [2, 4, 7, 15]),
    ("excretion", "Excretion", "body", "Defecation, urination and their place in the protagonist's day.", r"shit|excret\w*|defecat\w*|urin\w*|jakes|latrine", [4, 17]),
    ("voyeurism", "Voyeurism & the Keyhole", "body", "Watching Gerty, watching the keyhole in Circe: desire kept at a distance by the gaze.", r"watch\w*|gaz\w+|peep\w*|keyhole|spy\w*", [13, 15]),
    ("maternity", "Birth & Maternity", "body", "Mina Purefoy in labour; the child who died; the mother's womb and the mother's grave.", r"mother|womb|birth|born|labour|baby|maternity|pregnan\w*", [14, 15]),
    ("obscenity", "Obscenity & Censorship", "body", "Nausicaa was seized for obscenity; the novel's treatment of the body was the legal question.", r"obscen\w*|banned|seized|lewd|indecent|pornograph\w*", [13, 15]),
    ("funeral", "The Funeral", "death", "Burial logistics, insurance, the carriage; death as an administrative event.", r"funeral|burial|coffin|hearse|glasnevin", [6]),
    ("mother-deathbed", "The Mother's Deathbed", "death", "Stephen's refusal to pray at his mother's bed; the ghost that returns in Circe.", r"deathbed|dying mother|mary dedalus|his mother", [1, 3, 15]),
    ("ghost", "The Ghost", "death", "Dignam's spirit, Stephen's mother, the Shakespeare theory's ghost-father.", r"ghost|spirit|spectre|apparition|skeleton", [9, 15]),
    ("citizen-eye", "The Citizen's One Eye", "nation", "Cyclops: nationalism as a single eye, blind to complexity.", r"citizen|one eye|nationalis\w*|cyclops|gael\w*", [12]),
    ("colonial", "Colonial Curiosity", "nation", "Haines with his notebook; England as the polite occupier.", r"empire|england|english|britisher|haines|colonial|imperial|redcoats?|soldiers?", [1, 2, 15]),
    ("parody", "Parody & Pastiche", "language", "Gigantism in Cyclops, novelette in Nausicaa, mock-gospel in Oxen: style as subject.", r"parod\w*|mock\w*|pastiche|burlesque|travesty", [12, 13, 14]),
    ("prose-history", "The History of English Prose", "language", "Oxen of the Sun imitates English prose from Latin and Anglo-Saxon through to slang.", r"anglo-saxon|euphuis\w*|chaucer\w*|latin|bunyan|history of english|prose", [14]),
    ("metempsychosis", "Metempsychosis", "knowledge", "'Met him pike hoses': the transmigration of souls, misread into the novel's method.", r"metempsychosis|pike hoses|transmigrat\w*|reincarn\w*", [4, 18]),
    ("misreading", "Misreading & Mishearing", "knowledge", "Words heard wrong, names taken for others: understanding always slightly off.", r"misread\w*|misheard|mishear\w*|pike hoses|mistak\w*|misunderst\w*", [4, 11, 18]),
    ("unknowable", "The Unknowable Stranger", "knowledge", "The man in the macintosh; Boylan as 'the stranger': a figure about whom nothing is settled.", r"macintosh|mackintosh|stranger|mystery|unknown", [6, 10, 15]),
]
# Existing theme ids re-parented by the hierarchy (no change to their ids).
REPARENT = {
    "hamlet": "fatherhood", "desire": "cuckoldom", "women": "cuckoldom", "food": "body",
    "guilt": "death", "antisemitism": "nation", "religion": "nation",
    "music": "language", "stream": "language", "memory": "knowledge",
}
ROOT_THEMES = ["fatherhood", "cuckoldom", "death", "language", "exile", "body", "nation", "knowledge"]

# Regexes used to tag the 58 pre-existing nodes on quote blocks.
EXISTING_RX = {
    "bloom": r"bloom|leopold|henry flower", "molly": r"molly|marion|tweedy", "stephen": r"stephen|dedalus",
    "boylan": r"boylan|blazes", "mulligan": r"mulligan|buck", "dignam": r"dignam|paddy", "citizen": r"citizen",
    "gerty": r"gerty|macdowell", "martha": r"martha|clifford", "milly": r"milly", "rudy": r"rudy",
    "simon": r"simon", "douce": r"douce", "kennedy": r"kennedy", "deasy": r"deasy", "haines": r"haines",
    "kevin_egan": r"egan", "conmee": r"conmee",
    "cuckoldom": r"cuckold|cuckoo|betray\w*|jealous\w*|affair|adulter\w*", "fatherhood": r"father|fatherhood|paternal",
    "antisemitism": r"jews?|jewish|semit\w*|hebrew", "guilt": r"guilt\w*|remorse|agenbite|conscience|shame",
    "language": r"language|style|parod\w*|pastiche|prose", "music": r"music\w*|song|sang|tenor|melod\w*|fugue|sirens?",
    "hamlet": r"hamlet|shakespeare|hathaway|secondbest", "food": r"food|eat\w*|hungry|kidney|sandwich|dinner|appetite",
    "desire": r"desire|erotic|lust|sexual|longing|passion", "death": r"death|dead|funeral|grave|ghost|skeleton|dying",
    "religion": r"god|christ|church|mass|saint|pray\w*|litany|catholic|baptis\w*", "women": r"women|woman|girl|feminine",
    "memory": r"remember\w*|memory|forget|metempsychosis", "stream": r"stream of consciousness|interior|monologue",
    "martello": r"martello|tower", "eccles": r"eccles", "sandymount": r"sandymount|strand", "glasnevin": r"glasnevin|cemetery",
    "national_library": r"library", "ormond": r"ormond", "kiernans": r"kiernan|barney", "nighttown": r"nighttown|mabbot|bella",
}

# id, label, summary, episode
TECHNIQUES = [
    ("tq01", "Narrative (young)", "Telemachus is told in a plain, youthful narrative voice.", 1),
    ("tq02", "Catechism (personal)", "Nestor's question-and-answer lesson: the school catechism.", 2),
    ("tq03", "Monologue (male)", "Proteus is interior monologue, Stephen's mind on the strand.", 3),
    ("tq04", "Narrative (mature)", "Calypso is told in a fuller, more domestic narrative voice.", 4),
    ("tq05", "Narcissism", "Lotus Eaters drifts, passive and self-absorbed.", 5),
    ("tq06", "Incubism", "Hades: the weight of death pressing on the prose.", 6),
    ("tq07", "Enthymemic", "Aeolus: wind rhetoric and mock headlines break up the narrative.", 7),
    ("tq08", "Peristaltic", "Lestrygonians: the prose moves like digestion through hunger and disgust.", 8),
    ("tq09", "Dialectic", "Scylla and Charybdis: argument as form.", 9),
    ("tq10", "Labyrinth", "Wandering Rocks: nineteen vignettes crossing each other.", 10),
    ("tq11", "Fuga per canonem", "Sirens opens with a tuning of all its themes and is structured as a fugue.", 11),
    ("tq12", "Gigantism", "Cyclops inflates everything into epic parody.", 12),
    ("tq13", "Tumescence / detumescence", "Nausicaa swells and subsides with the fireworks and with Bloom.", 13),
    ("tq14", "Embryonic development", "Oxen of the Sun grows through the history of English prose, like a gestation.", 14),
    ("tq15", "Hallucination", "Circe is written as a play script; the unconscious takes the stage.", 15),
    ("tq16", "Narrative (old)", "Eumaeus is told in tired, rambling prose.", 16),
    ("tq17", "Catechism (impersonal)", "Ithaca's question-and-answer cosmos: the universe dwarfs the household.", 17),
    ("tq18", "Monologue (female)", "Penelope is Molly's unpunctuated soliloquy.", 18),
]

# id, label, summary, episode
SCHEMA = [
    ("sc-theology", "Art: Theology", "Telemachus", 1), ("sc-history", "Art: History", "Nestor", 2),
    ("sc-philology", "Art: Philology", "Proteus", 3), ("sc-economics", "Art: Economics", "Calypso", 4),
    ("sc-botany", "Art: Botany & Chemistry", "Lotus Eaters", 5), ("sc-rhetoric", "Art: Rhetoric", "Aeolus", 7),
    ("sc-architecture", "Art: Architecture", "Lestrygonians", 8), ("sc-literature", "Art: Literature", "Scylla and Charybdis", 9),
    ("sc-music", "Art: Music", "Sirens", 11), ("sc-politics", "Art: Politics", "Cyclops", 12),
    ("sc-medicine", "Art: Medicine", "Oxen of the Sun", 14), ("sc-magic", "Art: Magic", "Circe", 15),
]

# id, label, summary, characters, episodes, themes
CORRESPONDENCES = [
    ("co-odysseus", "Odysseus", "Bloom as the wanderer returning home.", ["bloom"], list(range(4, 19)), []),
    ("co-penelope", "Penelope", "Molly as the wife who waits and then speaks.", ["molly"], [18], []),
    ("co-telemachus", "Telemachus", "Stephen as the son in search of a father.", ["stephen"], [1, 2, 3, 9, 14, 15, 16, 17], ["telemachus"]),
    ("co-antinous", "Antinous & the Suitors", "Mulligan and Boylan as usurpers of the house.", ["mulligan", "boylan"], [1, 9, 11], ["usurpation"]),
    ("co-calypso", "Calypso", "Molly in the bed, the island Odysseus cannot leave.", ["molly"], [4], []),
    ("co-nestor", "Nestor", "Deasy as the old counsellor.", ["deasy"], [2], []),
    ("co-proteus", "Proteus", "The shape-shifting sea: everything changes under Stephen's gaze.", ["stephen", "kevin_egan"], [3], []),
    ("co-aeolus", "Aeolus", "The wind-keeper: the newspaper office and its rhetoric.", [], [7], []),
    ("co-lotus", "The Lotus Eaters", "Narcosis and passivity: Martha's letter, the bath.", ["martha"], [5], []),
    ("co-hades", "Hades & Elpenor", "The journey to the dead; Dignam as Elpenor.", ["dignam", "simon"], [6], ["funeral"]),
    ("co-polyphemus", "Polyphemus", "The Citizen as the one-eyed giant in his cave.", ["citizen"], [12], ["citizen-eye"]),
    ("co-nausicaa", "Nausicaa", "Gerty on the shore.", ["gerty"], [13], []),
    ("co-sirens", "The Sirens", "Miss Douce and Miss Kennedy behind the Ormond bar.", ["douce", "kennedy"], [11], []),
    ("co-scylla", "Scylla & Charybdis", "Between the rock of Aristotle and the whirlpool of Plato.", [], [9], ["hamlet"]),
    ("co-circe", "Circe", "Bella Cohen's house, where men become beasts.", ["bella", "zoe"], [15], ["masochism"]),
    ("co-oxen", "The Oxen of the Sun", "The sacred cattle: fertility and the taboo against harming it.", [], [14], ["maternity"]),
    ("co-eumaeus", "Eumaeus", "The swineherd's hut: the cabman's shelter.", ["bloom", "stephen"], [16], []),
    ("co-ithaca", "The Return to Ithaca", "The homecoming, the key, the bed.", ["bloom", "stephen", "molly"], [17, 18], ["equanimity"]),
]

# Hand-tagged theme ids per motif (the scan supplies episodes and quotes).
MOTIF_THEMES = {
    "m-music": ["music"], "m-voice": ["music", "women"], "m-dark": ["death", "ghost"], "m-lips": ["desire", "body"],
    "m-night": ["desire", "memory"], "m-eyes": ["voyeurism", "desire"], "m-letters": ["desire", "misreading"],
    "m-white": ["women", "desire"], "m-legs": ["voyeurism", "desire"], "m-clothes": ["masochism", "women"],
    "m-water": ["body", "memory"], "m-pockets": ["body", "memory"], "m-hair": ["desire", "women"],
    "m-thou": ["language", "parody"], "m-blue": ["women", "memory"], "m-hands": ["desire", "body"],
    "m-names": ["misreading", "unknowable"], "m-flowers": ["desire", "memory"], "m-green": ["nation", "memory"],
    "m-hat": ["cuckoldom", "boylan-double"], "m-bed": ["cuckoldom", "hamlet"], "m-bells": ["music", "four-oclock"],
    "m-skin": ["body", "desire"], "m-stranger": ["unknowable", "usurpation"], "m-veil": ["women", "desire"],
    "m-smell": ["body", "desire"], "m-dogs": ["citizen-eye", "ghost"], "m-gold": ["music", "women"],
    "m-tears": ["death", "memory"], "m-mirror": ["hamlet", "unknowable"], "m-jingle": ["cuckoldom", "four-oclock"],
    "m-hunger": ["food", "body"], "m-kidney": ["food", "body"], "m-smoke": ["body", "memory"],
    "m-lane": ["desire", "memory"], "m-eleven": ["rudy-days", "death"],
}

# Essays and the nodes each one argues across (hand-checked against HARD_ITEMS).
ESSAYS = {
    "boylan": dict(eps=[4, 10, 11, 15, 18], themes=["cuckoldom", "boylan-double", "four-oclock"], chars=["boylan", "bloom", "molly"]),
    "insecurity": dict(eps=[4, 15, 17], themes=["cuckoldom", "four-oclock", "masochism", "rudy-days"], chars=["bloom", "rudy"]),
    "enjoy": dict(eps=[15, 17], themes=["masochism", "equanimity", "voyeurism"], chars=["bloom"]),
}

# Nodes whose names appear only in the pasted commentary, never in a quoted
# Joyce passage, so no episode can be derived from the text. Linked by hand.
MANUAL_EPS = {"virag": [15], "davy_byrnes": [8], "bella_house": [15], "shelter": [16]}

# Character pairs with a named relationship. A pair is written to the graph only
# if some Joyce passage in the notes names both, and that passage's id is stored
# on the edge as its evidence. a, b, label.
RELATIONSHIPS = [
    ("bloom", "molly", "married"),
    ("molly", "boylan", "affair"),
    ("bloom", "boylan", "rival"),
    ("bloom", "stephen", "surrogate father and son"),
    ("bloom", "rudy", "father and dead son"),
    ("bloom", "milly", "father and daughter"),
    ("bloom", "virag", "son and father"),
    ("bloom", "martha", "secret correspondents"),
    ("bloom", "citizen", "antagonists"),
    ("bloom", "bella", "Bella and Bello humiliate him"),
    ("stephen", "simon", "son and father"),
    ("stephen", "mulligan", "friend turned usurper"),
    ("stephen", "deasy", "employee and employer"),
    ("stephen", "haines", "colonial guest"),
    ("stephen", "lynch", "companions in Nighttown"),
    ("molly", "milly", "mother and daughter"),
    ("gerty", "cissy", "friends"),
    ("gerty", "edy", "friends"),
    ("simon", "dollard", "singers at the Ormond"),
    ("douce", "kennedy", "barmaids"),
    ("zoe", "bella", "work in the same house"),
]

# Inline-link blocklist: ids whose regex also matches an ordinary word.
INLINE_SKIP = {"bloom", "power", "shelter", "carriage", "newspaper", "bullock", "carr", "key"}

# Episodes in book order, for `next` edges and first-seen ordering.
EPISODE_ORDER = list(range(1, 19))

ECHO_MIN_SHARED = 4
ECHO_PER_EPISODE = 3
