from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.resources.models import Category, Resource
from apps.resources.indexer import index_resource

User = get_user_model()

CATEGORIES = [
    {'name': 'Informatique',              'slug': 'informatique',  'icon': '💻'},
    {'name': 'Mathématiques',             'slug': 'mathematiques', 'icon': '📐'},
    {'name': 'Physique',                  'slug': 'physique',      'icon': '⚛️'},
    {'name': 'Réseaux',                   'slug': 'reseaux',       'icon': '🌐'},
    {'name': 'Intelligence artificielle', 'slug': 'ia',            'icon': '🤖'},
    {'name': 'Cybersécurité',             'slug': 'cybersecurite', 'icon': '🔒'},
    {'name': 'Data Science',              'slug': 'data-science',  'icon': '📊'},
    {'name': 'Électronique',              'slug': 'electronique',  'icon': '⚡'},
    {'name': 'Langues',                   'slug': 'langues',       'icon': '🗣️'},
    {'name': 'Gestion',                   'slug': 'gestion',       'icon': '📋'},
]

RESOURCES = [
    # ── Informatique ────────────────────────────────────────────────────────────
    {
        'title': 'Apprendre Python 3 — livre gratuit (PDF)',
        'description': 'Le livre de référence en français pour apprendre Python 3 de Gérard Swinnen. Couvre variables, boucles, fonctions, fichiers, POO.',
        'category': 'informatique', 'level': 'beginner', 'format': 'pdf', 'language': 'fr',
        'external_url': 'https://inforef.be/swi/download/apprendre_python3_5.pdf',
        'tags': ['python', 'programmation', 'débutant'],
    },
    {
        'title': 'Python pour débutants — Chaîne YouTube Docstring',
        'description': 'Série de tutoriels vidéo en français sur Python : syntaxe, POO, bibliothèques standard, projets pratiques.',
        'category': 'informatique', 'level': 'beginner', 'format': 'video', 'language': 'fr',
        'external_url': 'https://www.youtube.com/@Docstring_fr',
        'tags': ['python', 'programmation', 'tutoriel'],
    },
    {
        'title': 'Algorithmique et structures de données — MIT OCW (PDF)',
        'description': 'Notes de cours du MIT 6.006 : tri, arbres binaires, tables de hachage, graphes, programmation dynamique.',
        'category': 'informatique', 'level': 'intermediate', 'format': 'pdf', 'language': 'en',
        'external_url': 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/pages/lecture-notes/',
        'tags': ['algorithmes', 'structures de données', 'mit'],
    },
    {
        'title': 'Développement Web HTML/CSS/JS — MDN',
        'description': 'Documentation et tutoriels officiels Mozilla pour apprendre le développement web : HTML5, CSS3, JavaScript.',
        'category': 'informatique', 'level': 'beginner', 'format': 'html', 'language': 'fr',
        'external_url': 'https://developer.mozilla.org/fr/docs/Learn',
        'tags': ['html', 'css', 'javascript', 'web'],
    },
    {
        'title': 'SQL — tutoriels interactifs SQLZoo',
        'description': 'Apprenez le SQL de façon interactive : SELECT, JOIN, GROUP BY, sous-requêtes, et plus encore.',
        'category': 'informatique', 'level': 'beginner', 'format': 'html', 'language': 'en',
        'external_url': 'https://sqlzoo.net/wiki/SQL_Tutorial',
        'tags': ['sql', 'base de données', 'requêtes'],
    },
    {
        'title': 'Programmation en C — chaîne YouTube Graven',
        'description': 'Tutoriels vidéo en français sur la programmation C et C++ : pointeurs, mémoire, structures, fichiers.',
        'category': 'informatique', 'level': 'intermediate', 'format': 'video', 'language': 'fr',
        'external_url': 'https://www.youtube.com/@gravenilvectuto',
        'tags': ['c', 'c++', 'programmation', 'systèmes'],
    },

    # ── Mathématiques ───────────────────────────────────────────────────────────
    {
        'title': 'Algèbre linéaire — chaîne 3Blue1Brown (FR sous-titres)',
        'description': 'Série "Essence of Linear Algebra" — visualisations animées des vecteurs, matrices, déterminants et transformations linéaires.',
        'category': 'mathematiques', 'level': 'beginner', 'format': 'video', 'language': 'en',
        'external_url': 'https://www.youtube.com/playlist?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab',
        'tags': ['algèbre linéaire', 'vecteurs', 'matrices', 'visualisation'],
    },
    {
        'title': 'Cours de mathématiques — Mickaël Launay (YouTube)',
        'description': 'Vidéos de vulgarisation mathématique en français : théorie des nombres, probabilités, géométrie, histoire des maths.',
        'category': 'mathematiques', 'level': 'beginner', 'format': 'video', 'language': 'fr',
        'external_url': 'https://www.youtube.com/@MickaelLaunay',
        'tags': ['mathématiques', 'vulgarisation', 'probabilités'],
    },
    {
        'title': 'Analyse et calcul différentiel — MIT OCW (PDF)',
        'description': 'Notes complètes du cours 18.01 Single Variable Calculus du MIT : dérivées, intégrales, suites et séries.',
        'category': 'mathematiques', 'level': 'intermediate', 'format': 'pdf', 'language': 'en',
        'external_url': 'https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/pages/syllabus/',
        'tags': ['analyse', 'calcul', 'dérivation', 'intégration'],
    },
    {
        'title': 'Probabilités et statistiques — Khan Academy (FR)',
        'description': 'Cours complet sur les probabilités, variables aléatoires, distributions et inférences statistiques.',
        'category': 'mathematiques', 'level': 'beginner', 'format': 'html', 'language': 'fr',
        'external_url': 'https://fr.khanacademy.org/math/statistics-probability',
        'tags': ['probabilités', 'statistiques', 'distributions'],
    },

    # ── Intelligence artificielle ────────────────────────────────────────────────
    {
        'title': 'Machine Learning — chaîne Machine Learnia (YouTube)',
        'description': 'Série complète en français sur le machine learning : régression, SVM, arbres de décision, validation, scikit-learn.',
        'category': 'ia', 'level': 'intermediate', 'format': 'video', 'language': 'fr',
        'external_url': 'https://www.youtube.com/@MachineLearnia',
        'tags': ['machine learning', 'scikit-learn', 'régression', 'classification'],
    },
    {
        'title': 'Deep Learning Specialization — Andrew Ng (Coursera)',
        'description': 'La référence mondiale sur le deep learning : réseaux de neurones, CNN, RNN, optimisation, cas pratiques.',
        'category': 'ia', 'level': 'advanced', 'format': 'video', 'language': 'en',
        'external_url': 'https://www.youtube.com/playlist?list=PLkDaE6sCZn6Ec-XTbcX1uRg2_u4xOEky0',
        'tags': ['deep learning', 'CNN', 'RNN', 'neural networks'],
    },
    {
        'title': 'Introduction à l\'IA — chaîne YouTube Science4All',
        'description': 'Vulgarisation de l\'intelligence artificielle, éthique de l\'IA, biais algorithmiques et enjeux sociétaux.',
        'category': 'ia', 'level': 'beginner', 'format': 'video', 'language': 'fr',
        'external_url': 'https://www.youtube.com/@Science4allorg',
        'tags': ['ia', 'éthique', 'vulgarisation'],
    },

    # ── Réseaux ─────────────────────────────────────────────────────────────────
    {
        'title': 'Réseaux informatiques — modèle OSI et TCP/IP (YouTube)',
        'description': 'Cours vidéo complet sur les couches OSI, TCP/IP, adressage IP, routage, switching et protocoles réseau.',
        'category': 'reseaux', 'level': 'beginner', 'format': 'video', 'language': 'fr',
        'external_url': 'https://www.youtube.com/playlist?list=PLrSOXFDHBtfFq2P27a_WBn-YLbFzEQ0_F',
        'tags': ['réseaux', 'OSI', 'TCP/IP', 'routage'],
    },
    {
        'title': 'Administration système Linux — OpenClassrooms',
        'description': 'Gestion des utilisateurs, permissions, processus, services, scripts shell et automatisation sous Linux.',
        'category': 'reseaux', 'level': 'intermediate', 'format': 'html', 'language': 'fr',
        'external_url': 'https://openclassrooms.com/fr/courses/7170491-administrez-un-systeme-linux',
        'tags': ['linux', 'administration', 'shell', 'bash'],
    },

    # ── Cybersécurité ───────────────────────────────────────────────────────────
    {
        'title': 'Introduction à la cybersécurité — ANSSI (PDF)',
        'description': 'Guide officiel de l\'ANSSI pour comprendre les menaces, les bonnes pratiques et les bases de la sécurité informatique.',
        'category': 'cybersecurite', 'level': 'beginner', 'format': 'pdf', 'language': 'fr',
        'external_url': 'https://www.ssi.gouv.fr/uploads/2015/10/guide_hygiene_informatique_anssi.pdf',
        'tags': ['cybersécurité', 'ANSSI', 'bonnes pratiques', 'sécurité'],
    },
    {
        'title': 'Hacking éthique — chaîne YouTube Hafnium (FR)',
        'description': 'Tutoriels en français sur la sécurité offensive et défensive : pentest, CTF, OWASP, Kali Linux.',
        'category': 'cybersecurite', 'level': 'intermediate', 'format': 'video', 'language': 'fr',
        'external_url': 'https://www.youtube.com/@hafnium_sec',
        'tags': ['hacking éthique', 'pentest', 'CTF', 'kali linux'],
    },

    # ── Data Science ────────────────────────────────────────────────────────────
    {
        'title': 'Data Science avec Python — Kaggle Learn',
        'description': 'Cours pratiques et interactifs sur Pandas, visualisation, feature engineering, et modélisation avec Python.',
        'category': 'data-science', 'level': 'intermediate', 'format': 'html', 'language': 'en',
        'external_url': 'https://www.kaggle.com/learn',
        'tags': ['data science', 'pandas', 'python', 'kaggle'],
    },
    {
        'title': 'Visualisation de données — chaîne YouTube StatQuest',
        'description': 'Explications claires et visuelles des concepts de data science et statistiques, avec code Python et R.',
        'category': 'data-science', 'level': 'beginner', 'format': 'video', 'language': 'en',
        'external_url': 'https://www.youtube.com/@statquest',
        'tags': ['statistiques', 'visualisation', 'data science', 'machine learning'],
    },

    # ── Physique ────────────────────────────────────────────────────────────────
    {
        'title': 'Physique — vulgarisation par e-penser (YouTube)',
        'description': 'Émission de vulgarisation scientifique en français : mécanique quantique, relativité, astrophysique, électromagnétisme.',
        'category': 'physique', 'level': 'beginner', 'format': 'video', 'language': 'fr',
        'external_url': 'https://www.youtube.com/@epenser',
        'tags': ['physique', 'vulgarisation', 'quantique', 'relativité'],
    },
    {
        'title': 'Mécanique classique — MIT OCW (PDF)',
        'description': 'Cours complet 8.01 du MIT : cinématique, dynamique newtonienne, énergie, systèmes de particules.',
        'category': 'physique', 'level': 'intermediate', 'format': 'pdf', 'language': 'en',
        'external_url': 'https://ocw.mit.edu/courses/8-01sc-classical-mechanics-fall-2016/pages/syllabus/',
        'tags': ['mécanique', 'newton', 'cinématique', 'dynamique'],
    },

    # ── Électronique ────────────────────────────────────────────────────────────
    {
        'title': 'Électronique numérique — tutoriels Neso Academy (YouTube)',
        'description': 'Cours vidéo sur la logique numérique : portes logiques, circuits combinatoires, bascules, compteurs.',
        'category': 'electronique', 'level': 'beginner', 'format': 'video', 'language': 'en',
        'external_url': 'https://www.youtube.com/playlist?list=PLBlnK6fEyqRjMH3mWf6kwqiTbT798eAOm',
        'tags': ['électronique numérique', 'logique', 'portes logiques', 'bascules'],
    },

    # ── Langues ─────────────────────────────────────────────────────────────────
    {
        'title': 'Anglais technique pour informaticiens — BBC Learning English',
        'description': 'Ressources gratuites pour apprendre l\'anglais technique et professionnel dans le domaine de l\'informatique.',
        'category': 'langues', 'level': 'beginner', 'format': 'html', 'language': 'en',
        'external_url': 'https://www.bbc.co.uk/learningenglish',
        'tags': ['anglais', 'technique', 'informatique', 'professionnel'],
    },

    # ── Gestion ─────────────────────────────────────────────────────────────────
    {
        'title': 'Gestion de projet — OpenClassrooms',
        'description': 'Méthodes agiles, Scrum, Kanban, planification de projet, gestion des risques et livrables.',
        'category': 'gestion', 'level': 'beginner', 'format': 'html', 'language': 'fr',
        'external_url': 'https://openclassrooms.com/fr/courses/4507926-initiez-vous-a-la-gestion-de-projet-agile',
        'tags': ['gestion de projet', 'agile', 'scrum', 'kanban'],
    },
]


class Command(BaseCommand):
    help = 'Seed the database with initial categories and sample resources'

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true', help='Clear existing data before seeding')

    def handle(self, *args, **options):
        if options['clear']:
            Resource.objects.all().delete()
            Category.objects.all().delete()
            self.stdout.write('Cleared existing data.')

        teacher, created = User.objects.get_or_create(
            username='admin_pilearn',
            defaults={
                'email': 'admin@pilearn.local',
                'role': 'admin',
                'first_name': 'PiLearn',
                'last_name': 'Admin',
                'is_staff': True,
                'is_superuser': True,
            }
        )
        if created:
            teacher.set_password('learnly2026')
            teacher.save()
            self.stdout.write('Created admin user: admin_pilearn')

        cat_map = {}
        for c in CATEGORIES:
            obj, _ = Category.objects.get_or_create(slug=c['slug'], defaults={
                'name': c['name'], 'icon': c['icon']
            })
            cat_map[c['slug']] = obj

        created_count = 0
        for r in RESOURCES:
            cat = cat_map.get(r['category'])
            obj, was_created = Resource.objects.get_or_create(
                title=r['title'],
                defaults={
                    'description': r['description'],
                    'category': cat,
                    'level': r['level'],
                    'format': r['format'],
                    'language': r['language'],
                    'external_url': r.get('external_url', ''),
                    'tags': r.get('tags', []),
                    'uploaded_by': teacher,
                    'is_validated': True,
                    'is_active': True,
                }
            )
            if was_created:
                index_resource(obj)
                created_count += 1
                self.stdout.write(f'  + {obj.title}')

        self.stdout.write(self.style.SUCCESS(
            f'Done. {created_count} resources created across {len(cat_map)} categories.'
        ))
