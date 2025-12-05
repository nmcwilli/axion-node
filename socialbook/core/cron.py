import datetime
import logging
import requests
from bs4 import BeautifulSoup
from django_cron import CronJobBase, Schedule
from django.conf import settings
from django.contrib.auth import get_user_model
from core.models import Post, Community
from openai import OpenAI
import re

# This is an optional scraper you can use to post content in your platform
# To use this properly, you must have a fully working platform and then have a user configured to
# post the content. In the example below, we have a user called newsaibot

# Setup logging
logger = logging.getLogger(__name__)

# Set OpenAI key from settings
client = OpenAI(api_key=settings.OPENAI_API_KEY)

class ScrapeCronJob(CronJobBase):
    RUN_AT_TIMES = ['07:00']
    schedule = Schedule(run_at_times=RUN_AT_TIMES)
    code = 'core.scrape_cron_job'

    def do(self):
        regions = [
            {
                "url": "https://URLHERE",
                "slug": "url-slug-here",
                "title_prefix": "Title Prefix Here"
            },
            {
                "url": "https://URL2HERE",
                "slug": "url-slug2-here",
                "title_prefix": "Title 2 Prefix Here"
            }
        ]

        for region in regions:
            self.scrape_and_post(
                url=region["url"],
                community_slug=region["slug"],
                post_title_prefix=region["title_prefix"]
            )

    def scrape_and_post(self, url, community_slug, post_title_prefix):
        headers = {'User-Agent': 'Mozilla/5.0'}
        try:
            response = requests.get(url, headers=headers)
            soup = BeautifulSoup(response.content, 'html.parser')
        except Exception as e:
            logger.error(f"Failed to fetch {url}: {str(e)}")
            return

        articles = soup.find_all('a', href=True)
        article_links = []
        seen = set()
        MAX_ARTICLES = 20  # gather more in case some are filtered out later

        # Pattern you're looking at will need to be customized
        news_url_pattern = re.compile(
            r"^https:\/\/www\.domain\.com\/news\/(?:region(?:\/[\w-]+)?|topic\/Tag\/[\w-]+|world)\/[\w\-]+-1\.\d{7}$"
        )

        for a in articles:
            href = a['href']
            full_url = f"https://urlhereman{href}" if href.startswith('/') else href

            if news_url_pattern.match(full_url) and full_url not in seen:
                article_links.append(full_url)
                seen.add(full_url)

            if len(article_links) >= MAX_ARTICLES:
                break

        if not article_links:
            logger.warning(f"No article links found for {url}")
            return

        summaries = []
        sources = []
        MAX_SUMMARIES = 10 # Setting the total number of max summaries

        for link in article_links:
            if len(summaries) >= MAX_SUMMARIES:
                break

            try:
                article_resp = requests.get(link, headers=headers)
                article_soup = BeautifulSoup(article_resp.content, 'html.parser')
                paragraphs = article_soup.find_all('p')
                content = " ".join([p.get_text() for p in paragraphs if p.get_text()])

                if not content.strip():
                    continue

                summary = self.summarize_with_gpt(content)
                title = article_soup.find('title').get_text(strip=True).split(" |")[0]

                skip_titles = [
                    "Skip titles like this one",
                    "And this one!",
                    "Because I don't like them",
                ]
                if title in skip_titles or "does not mention any real news" in summary.lower():
                    continue

                summaries.append(f"{title}\n{summary}")
                sources.append(f"[🔗 Source]({link})")
            except Exception as e:
                logger.error(f"Error scraping article {link}: {str(e)}")

        if not summaries:
            logger.warning(f"No summaries were created for {community_slug}")
            return

        disclaimer = (
            "\n\n🤖 Note: This is an automated summary of news articles. "
            "Sources are credited below."
        )
        sources_list = "\n\n📚 Sources:\n" + "\n".join(sources)
        full_content = "\n\n---\n\n".join(summaries).strip() + disclaimer + sources_list

        # Get community and bot user
        community = Community.objects.filter(slug=community_slug).first()
        User = get_user_model()
        bot_user = User.objects.filter(username='newsaibot').first()

        if not community:
            logger.error(f"Community '{community_slug}' not found.")
            return
        if not bot_user:
            logger.error("User 'newsaibot' not found.")
            return

        today_title = f"{post_title_prefix} - {datetime.date.today()}"
        if Post.objects.filter(title=today_title, author=bot_user, community=community).exists():
            logger.info(f"Post already exists for {community_slug} today.")
            return

        Post.objects.create(
            community=community,
            author=bot_user,
            title=today_title,
            content=full_content,
            status="active"
        )

        logger.info(f"AI Summary post created successfully for {community_slug}")

    def summarize_with_gpt(self, content: str) -> str:
        try:
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a journalist assistant. Summarize the article in 2–3 short bullet points. "
                            "Be extremely concise and focus only on real news events or developments. "
                            "Limit the total summary to 300 characters."
                        )
                    },
                    {"role": "user", "content": content[:3500]}
                ]
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"OpenAI API error: {str(e)}")
            return "⚠️ Failed to generate summary."